import {
    auth,
    db
} from "./firebase.js";


import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
    doc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

/* =========================================
   ELEMENTS
========================================= */

const listingForm =
    document.getElementById("listingForm");


const listingMessage =
    document.getElementById("listingMessage");


const listingContainer =
    document.getElementById("listingsContainer");


const listingCount =
    document.getElementById("listingCount");


const navUserName =
    document.getElementById("navUserName");


const logoutButton =
    document.getElementById("logoutButton");


const createListingButton =
    document.getElementById("createListingButton");

const pickupAddressInput =
    document.getElementById("pickupAddress");

const locationMapElement =
    document.getElementById("locationMap");

const useCurrentLocationButton =
    document.getElementById("useCurrentLocation");

const locationMessage =
    document.getElementById("locationMessage");



/* =========================================
   CURRENT USER
========================================= */

let currentUser = null;
let currentDonorProfile = null;
let locationMap = null;
let locationMarker = null;
let selectedCoordinates = null;


initializeLocationPicker();



/* =========================================
   AUTHENTICATION CHECK
========================================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "index.html";

            return;

        }


        currentUser = user;


        try {

            /*
             * Get user's Firestore profile
             */

            const userSnapshot =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (!userSnapshot.exists()) {

                alert(
                    "User profile not found."
                );

                await signOut(auth);

                window.location.href =
                    "index.html";

                return;

            }


            const userData =
                userSnapshot.data();

            currentDonorProfile = userData;


            /*
             * Check role
             */

            if (userData.role !== "Donor") {

                alert(
                    "This dashboard is only available to donors."
                );

                window.location.href =
                    userData.role === "Recipient"
                        ? "recipient-dashboard.html"
                        : "index.html";

                return;

            }


            /*
             * Display name
             */

            navUserName.textContent =
                userData.name;


            /*
             * Load donor listings
             */

            await loadMyListings();


        } catch (error) {

            console.error(
                "Dashboard error:",
                error
            );

        }

    }
);



/* =========================================
   CREATE LISTING
========================================= */

listingForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        if (!currentUser) {

            listingMessage.textContent =
                "You must be logged in.";

            listingMessage.style.color =
                "#dc2626";

            return;

        }


        const foodItem =
            document
                .getElementById("foodItem")
                .value
                .trim();


        const quantity =
            document
                .getElementById("quantity")
                .value
                .trim();


        const pickupAddress =
            document
                .getElementById("pickupAddress")
                .value
                .trim();

        const foodPhoto =
            document.getElementById("foodPhoto")
                .files[0];


        /*
         * Basic validation
         */

        if (
            foodItem === "" ||
            quantity === "" ||
            pickupAddress === "" ||
            !foodPhoto
        ) {

            listingMessage.textContent =
                "Food item name, food photo, quantity, and pickup address are required.";

            listingMessage.style.color =
                "#dc2626";

            return;

        }


        /*
         * Disable button
         */

        createListingButton.disabled =
            true;


        createListingButton.innerHTML =
            "Publishing...";


        listingMessage.textContent =
            "";


        try {

            listingMessage.textContent =
                "Preparing photo...";
            listingMessage.style.color =
                "#5e8a20";

            const foodImageUrl =
                await compressImage(
                    foodPhoto
                );

            createListingButton.textContent =
                "Saving listing...";

            /*
             * Create listing document
             */

            const listingReference =
                await addDoc(
                    collection(
                        db,
                        "listings"
                    ),
                    {

                        donorId:
                            currentUser.uid,

                        donorName:
                            currentDonorProfile?.name ||
                            "Food donor",

                        donorPhone:
                            currentDonorProfile?.phone ||
                            currentDonorProfile?.phoneNumber ||
                            "",

                        foodImageUrl:
                            foodImageUrl,

                        foodItem:
                            foodItem,

                        quantity:
                            quantity,

                        pickupAddress:
                            pickupAddress,

                        pickupLatitude:
                            selectedCoordinates?.latitude ||
                            null,

                        pickupLongitude:
                            selectedCoordinates?.longitude ||
                            null,

                        status:
                            "Available",

                        claimedBy:
                            null,

                        createdAt:
                            serverTimestamp()

                    }
                );


            console.log(
                "Listing created:",
                listingReference.id
            );


            /*
             * Success
             */

            listingMessage.textContent =
                "Food listing published successfully!";


            listingMessage.style.color =
                "#5e8a20";


            /*
             * Clear form
             */

            listingForm.reset();


            /*
             * Reload listings
             */

            await loadMyListings();


        } catch (error) {

            console.error(
                "CREATE LISTING ERROR:",
                error
            );


            listingMessage.textContent =
                getListingError(error);


            listingMessage.style.color =
                "#dc2626";

        }


        /*
         * Re-enable button
         */

        createListingButton.disabled =
            false;


        createListingButton.innerHTML =
            "Publish Food Listing <span>→</span>";

    }
);



/* =========================================
   LOAD DONOR LISTINGS
========================================= */

async function loadMyListings() {

    if (!currentUser) {
        return;
    }

    try {

        console.log("Loading listings for:", currentUser.uid);

        const listingsQuery =
            query(
                collection(db, "listings")
            );

        const snapshot =
            await getDocs(listingsQuery);

        console.log(
            "Total listings found:",
            snapshot.size
        );

        const listings = [];

        snapshot.forEach(
            (listingDocument) => {

                const data =
                    listingDocument.data();

                if (
                    data.donorId ===
                    currentUser.uid
                ) {

                    listings.push({

                        id:
                            listingDocument.id,

                        ...data

                    });

                }

            }
        );

        listings.sort(
            (a, b) => {

                const dateA =
                    a.createdAt
                        ? a.createdAt.toMillis()
                        : 0;

                const dateB =
                    b.createdAt
                        ? b.createdAt.toMillis()
                        : 0;

                return dateB - dateA;

            }
        );

        listingCount.textContent =
            `${listings.length} ${listings.length === 1
                ? "listing"
                : "listings"
            }`;

        listingContainer.innerHTML =
            "";

        if (listings.length === 0) {

            listingContainer.innerHTML = `

                <div class="empty-listings">

                    <div class="empty-icon">
                        +
                    </div>

                    <h3>
                        No food listings yet
                    </h3>

                    <p>
                        Create your first listing above
                        to share surplus food.
                    </p>

                </div>

            `;

            return;
        }

        listings.forEach(
            (listing) => {

                renderListing(
                    listing.id,
                    listing
                );

            }
        );

    } catch (error) {

        console.error(
            "LOAD LISTINGS ERROR:",
            error
        );

        console.error(
            "Error code:",
            error.code
        );

        console.error(
            "Error message:",
            error.message
        );

        listingContainer.innerHTML = `

            <div class="empty-listings">

                <div class="empty-icon">
                    !
                </div>

                <h3>
                    Unable to load listings
                </h3>

                <p>
                    ${escapeHTML(
            error.message ||
            "Unknown Firestore error"
        )}
                </p>

            </div>

        `;

    }

}



/* =========================================
   RENDER LISTING
========================================= */

function renderListing(
    listingId,
    data
) {

    let dateText =
        "Just now";


    if (data.createdAt) {

        const date =
            data.createdAt.toDate();


        dateText =
            date.toLocaleDateString(
                "en-IN",
                {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                }
            );

    }


    const card =
        document.createElement("div");


    card.className =
        "listing-card";


    card.innerHTML = `

        <div class="listing-card-top">

            <span class="listing-status">

                <span class="listing-status-dot"></span>

                ${escapeHTML(data.status)}

            </span>


            <span class="listing-date">

                ${dateText}

            </span>

        </div>


        <h3>
            ${escapeHTML(data.foodItem)}
        </h3>


        ${data.foodImageUrl
            ? `
                <img
                    class="listing-food-image"
                    src="${escapeHTML(data.foodImageUrl)}"
                    alt="${escapeHTML(data.foodItem)}"
                >
            `
            : ""
        }


        <p class="listing-quantity">

            ${escapeHTML(data.quantity)}

        </p>


        <div class="listing-location">

            📍
            ${escapeHTML(data.pickupAddress)}

        </div>


        <p class="listing-id">

            Listing ID:
            ${escapeHTML(listingId)}

        </p>

    `;


    listingContainer.appendChild(card);

}



async function compressImage(file) {

    const image = new Image();
    const imageUrl = URL.createObjectURL(file);

    try {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = imageUrl;
        });

        const maxSize = 900;
        const scale = Math.min(
            1,
            maxSize / Math.max(image.width, image.height)
        );
        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        canvas.getContext("2d").drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return canvas.toDataURL(
            "image/jpeg",
            0.65
        );
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
}


function initializeLocationPicker() {

    if (!locationMapElement || typeof L === "undefined") {
        return;
    }

    locationMap = L.map(locationMapElement).setView(
        [20.5937, 78.9629],
        5
    );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors"
        }
    ).addTo(locationMap);

    locationMap.on("click", (event) => {
        setSelectedLocation(
            event.latlng.lat,
            event.latlng.lng
        );
    });

    useCurrentLocationButton?.addEventListener(
        "click",
        useCurrentLocation
    );
}


function useCurrentLocation() {

    if (!navigator.geolocation) {
        setLocationMessage(
            "Your browser does not support location access."
        );
        return;
    }

    setLocationMessage("Finding your current location...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            setSelectedLocation(
                position.coords.latitude,
                position.coords.longitude
            );
        },
        () => {
            setLocationMessage(
                "Location access was blocked. Click the map or enter the address manually."
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}


function setSelectedLocation(latitude, longitude) {

    selectedCoordinates = {
        latitude,
        longitude
    };

    if (locationMarker) {
        locationMarker.setLatLng([
            latitude,
            longitude
        ]);
    } else {
        locationMarker = L.marker([
            latitude,
            longitude
        ]).addTo(locationMap);
    }

    locationMap.setView(
        [latitude, longitude],
        16
    );

    setLocationMessage("Getting the address for this location...");

    fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
    )
        .then((response) => {
            if (!response.ok) {
                throw new Error("Unable to find the address.");
            }

            return response.json();
        })
        .then((data) => {
            pickupAddressInput.value =
                data.display_name ||
                `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            setLocationMessage("Pickup location selected.");
        })
        .catch(() => {
            pickupAddressInput.value =
                `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            setLocationMessage(
                "Location selected. Please check the address before publishing."
            );
        });
}


function setLocationMessage(message) {

    if (locationMessage) {
        locationMessage.textContent = message;
    }
}


/* =========================================
   HTML ESCAPE
========================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}



/* =========================================
   ERROR HANDLING
========================================= */

function getListingError(error) {

    console.error(
        "Firestore error:",
        error.code,
        error.message
    );


    if (
        error.code ===
        "permission-denied"
    ) {

        return (
            "Permission denied. Check your Firestore Rules."
        );

    }


    if (
        error.code ===
        "storage/unauthorized"
    ) {
        return (
            "Photo upload was blocked. Check Firebase Storage rules."
        );
    }


    if (
        error.code ===
        "storage/quota-exceeded"
    ) {
        return (
            "Photo storage is full. Try again later."
        );
    }


    if (
        error.code ===
        "storage/retry-limit-exceeded"
    ) {
        return (
            "Photo upload timed out. Check your internet connection and try again."
        );
    }


    if (
        error.code ===
        "failed-precondition"
    ) {

        return (
            "Firestore needs an index. Check the browser console."
        );

    }


    if (
        error.code ===
        "unavailable"
    ) {

        return (
            "Firebase is temporarily unavailable. Try again."
        );

    }


    return (
        error.message ||
        "Unable to create listing."
    );

}



/* =========================================
   LOGOUT
========================================= */

function redirectToLandingPage() {
    window.location.href = "index.html";
}


logoutButton.addEventListener(
    "click",
    async () => {

        try {

            await signOut(auth);

            redirectToLandingPage();

        } catch (error) {

            console.error(
                "Logout error:",
                error
            );

        }

    }
);