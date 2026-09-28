import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    collection,
    getDocs,
    doc,
    getDoc,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================
   DOM ELEMENTS
========================================= */

const foodContainer =
    document.getElementById("foodContainer");

const foodCount =
    document.getElementById("foodCount");

const pageMessage =
    document.getElementById("pageMessage");

const logoutButton =
    document.getElementById("logoutButton");


let currentUser = null;
const nearbyRadiusKm = 25;


/* =========================================
   AUTHENTICATION
========================================= */

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }


        currentUser = user;

        console.log(
            "Recipient logged in:",
            user.uid
        );


        /*
         * Check user's role
         */

        try {

            const userDocument =
                await getDoc(
                    doc(
                        db,
                        "users",
                        user.uid
                    )
                );


            if (!userDocument.exists()) {

                console.error(
                    "User profile not found."
                );

                await signOut(auth);

                window.location.href =
                    "login.html";

                return;
            }


            const userData =
                userDocument.data();


            if (
                userData.role !==
                "Recipient"
            ) {

                alert(
                    "This page is available only to recipients."
                );

                window.location.href =
                    "dashboard.html";

                return;
            }


            /*
             * Load available food
             */

            const recipientLocation =
                await getRecipientLocation();

            await loadAvailableFood(
                recipientLocation
            );


        } catch (error) {

            console.error(
                "AUTH/ROLE ERROR:",
                error
            );

            showError(
                "Unable to verify your account."
            );

        }

    }
);


/* =========================================
   LOAD AVAILABLE FOOD
========================================= */

async function loadAvailableFood(recipientLocation) {

    try {

        showLoading();


        const snapshot =
            await getDocs(
                collection(
                    db,
                    "listings"
                )
            );


        foodContainer.innerHTML =
            "";


        const listings = [];


        snapshot.forEach(
            (listingDocument) => {

                const listing = listingDocument.data();
                const status = String(listing.status || "").toLowerCase();

                const listingLatitude =
                    Number(listing.pickupLatitude);
                const listingLongitude =
                    Number(listing.pickupLongitude);
                const hasCoordinates =
                    Number.isFinite(listingLatitude) &&
                    Number.isFinite(listingLongitude);
                const distanceKm = hasCoordinates
                    ? getDistanceInKm(
                        recipientLocation.latitude,
                        recipientLocation.longitude,
                        listingLatitude,
                        listingLongitude
                    )
                    : Infinity;

                if (
                    status === "available" &&
                    distanceKm <= nearbyRadiusKm
                ) {
                    listings.push({
                        id: listingDocument.id,
                        ...listing,
                        distanceKm
                    });
                }

            }
        );


        console.log(
            "Available listings:",
            listings.length
        );


        foodCount.textContent =
            `${listings.length} ${listings.length === 1
                ? "food listing"
                : "food listings"
            }`;

        pageMessage.textContent =
            `Showing available food within ${nearbyRadiusKm} km of your location.`;


        if (listings.length === 0) {

            showEmpty();

            return;
        }


        /*
         * Show the closest available food first.
         */

        listings.sort(
            (a, b) => {

                return a.distanceKm - b.distanceKm;

            }
        );


        /*
         * Display listings.
         */

        listings.forEach(
            (listing) => {

                renderFoodCard(
                    listing.id,
                    listing
                );

            }
        );


    } catch (error) {

        console.error(
            "LOAD FOOD ERROR:",
            error
        );


        showError(
            error.message ||
            "Unable to load available food."
        );

    }

}


function getRecipientLocation() {

    if (!navigator.geolocation) {
        throw new Error(
            "Location access is required to show food near you."
        );
    }

    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
            },
            () => {
                reject(new Error(
                    "Please allow location access to see available food near you."
                ));
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    });
}


function getDistanceInKm(
    firstLatitude,
    firstLongitude,
    secondLatitude,
    secondLongitude
) {

    const earthRadiusKm = 6371;
    const latitudeDifference =
        degreesToRadians(secondLatitude - firstLatitude);
    const longitudeDifference =
        degreesToRadians(secondLongitude - firstLongitude);
    const latitudeOne =
        degreesToRadians(firstLatitude);
    const latitudeTwo =
        degreesToRadians(secondLatitude);
    const haversine =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(latitudeOne) *
        Math.cos(latitudeTwo) *
        Math.sin(longitudeDifference / 2) ** 2;

    return earthRadiusKm *
        2 *
        Math.atan2(
            Math.sqrt(haversine),
            Math.sqrt(1 - haversine)
        );
}


function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}


function getTimestampValue(value) {

    if (!value) {
        return 0;
    }

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    const timestamp = new Date(value).getTime();

    return Number.isNaN(timestamp) ? 0 : timestamp;
}


/* =========================================
   RENDER FOOD CARD
========================================= */

function renderFoodCard(
    listingId,
    listing
) {

    const card =
        document.createElement("article");


    card.className =
        "food-card";


    const foodItem =
        escapeHTML(
            listing.foodItem ||
            "Food Item"
        );


    const quantity =
        escapeHTML(
            listing.quantity ||
            "Quantity not specified"
        );


    card.innerHTML = `

        <div class="food-card-top">

            <span class="available-badge">

                <span></span>

                AVAILABLE

            </span>

            <span class="food-distance">
                ${listing.distanceKm.toFixed(1)} km away
            </span>

        </div>


        <div class="food-icon">
            ${listing.foodImageUrl
            ? `
                    <button
                        type="button"
                        class="food-image-button"
                        aria-label="Preview ${foodItem} photo"
                    >
                        <img
                            class="food-image"
                            src="${escapeHTML(listing.foodImageUrl)}"
                            alt="${foodItem}"
                        >
                    </button>
                `
            : "🍲"
        }
        </div>


        <h3>
            ${foodItem}
        </h3>


        <div class="food-quantity">

            <span class="detail-label">
                Quantity
            </span>

            <strong>
                ${quantity}
            </strong>

        </div>


        <div class="pickup-locked">

            <div class="lock-icon">
                🔒
            </div>

            <div>

                <strong>
                    Pickup details hidden
                </strong>

                <span>
                    Claim this food to view
                    the pickup address.
                </span>

            </div>

        </div>


        <button
            class="claim-button"
            data-listing-id="${listingId}">

            <span>
                Claim This Food
            </span>

            <span>
                →
            </span>

        </button>

    `;


    foodContainer.appendChild(
        card
    );


    const foodImage =
        card.querySelector(".food-image");

    foodImage?.addEventListener(
        "click",
        () => showFoodPreview(
            listing.foodImageUrl,
            foodItem
        )
    );


    const claimButton =
        card.querySelector(
            ".claim-button"
        );


    claimButton.addEventListener(
        "click",
        () => {

            claimFood(
                listingId,
                claimButton
            );

        }
    );

}


function showFoodPreview(imageUrl, foodName) {

    let preview =
        document.getElementById("foodPreview");

    if (!preview) {
        preview = document.createElement("div");
        preview.id = "foodPreview";
        preview.className = "food-preview";
        preview.innerHTML = `
            <div class="food-preview-panel" role="dialog" aria-modal="true" aria-label="Food photo preview">
                <button type="button" class="food-preview-close" aria-label="Close photo preview">&times;</button>
                <img class="food-preview-image" alt="">
            </div>
        `;
        document.body.appendChild(preview);

        preview.addEventListener("click", (event) => {
            if (
                event.target === preview ||
                event.target.closest(".food-preview-close")
            ) {
                preview.classList.remove("is-visible");
            }
        });
    }

    const previewImage =
        preview.querySelector(".food-preview-image");

    previewImage.src = imageUrl;
    previewImage.alt = foodName;
    preview.classList.add("is-visible");
}


document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        document
            .getElementById("foodPreview")
            ?.classList.remove("is-visible");
    }
});


/* =========================================
   CLAIM FOOD
========================================= */

async function claimFood(listingId, button) {

    if (!currentUser) {
        alert("Please login first.");
        return;
    }

    button.disabled = true;
    button.innerHTML = `<span>Claiming...</span>`;

    try {

        console.log("CLAIM START:", listingId);

        const listingReference = doc(
            db,
            "listings",
            listingId
        );

        let claimedListing = null;

        /* =========================================
           CLAIM TRANSACTION
        ========================================= */

        await runTransaction(
            db,
            async (transaction) => {

                const listingDocument =
                    await transaction.get(
                        listingReference
                    );

                if (!listingDocument.exists()) {
                    throw new Error(
                        "This food listing no longer exists."
                    );
                }

                const listing =
                    listingDocument.data();

                console.log(
                    "LISTING BEFORE CLAIM:",
                    listing
                );

                if (
                    listing.status !== "Available"
                ) {
                    throw new Error(
                        "Sorry, this food has already been claimed."
                    );
                }

                // Save listing data so we don't need
                // another listing getDoc() later.
                claimedListing = {
                    id: listingId,
                    ...listing
                };

                transaction.update(
                    listingReference,
                    {
                        status: "Claimed",
                        claimedBy: currentUser.uid
                    }
                );
            }
        );

        console.log(
            "CLAIM TRANSACTION SUCCESS"
        );

        /* =========================================
           SHOW DETAILS
        ========================================= */

        await showClaimedFood(
            listingId,
            claimedListing
        );

    } catch (error) {

        console.error(
            "CLAIM FOOD ERROR:",
            error
        );

        button.disabled = false;

        button.innerHTML = `
            <span>
                Claim This Food
            </span>

            <span>
                →
            </span>
        `;

        alert(
            error.message ||
            "Unable to claim this food."
        );

    }

}

/* =========================================
   SHOW CLAIMED FOOD
========================================= */

async function showClaimedFood(
    listingId,
    listing
) {

    try {

        console.log(
            "SHOW CLAIMED FOOD:",
            listing
        );


        /* =========================================
           FOOD DETAILS
        ========================================= */

        const foodName =
            listing.foodItem ||
            listing.foodName ||
            "Food Item";


        const pickupAddress =
            listing.pickupAddress ||
            listing.address ||
            listing.pickupLocation ||
            "Pickup address not available";


        /* =========================================
           DONOR DETAILS
        ========================================= */

        let donorName =
            listing.donorName ||
            "Food donor";


        let donorPhone =
            listing.donorPhone ||
            listing.phone ||
            listing.phoneNumber ||
            "";

        let donorProfilePromise =
            Promise.resolve({
                profile: null,
                contact: null
            });


        /* =========================================
           GET DONOR PROFILE
        ========================================= */

        if (listing.donorId) {
            donorProfilePromise = Promise.all([
                getDoc(
                    doc(
                        db,
                        "users",
                        listing.donorId
                    )
                ),
                getDoc(
                    doc(
                        db,
                        "donorContacts",
                        listing.donorId
                    )
                )
            ]).then(([profile, contact]) => ({
                profile,
                contact
            })).catch((donorError) => {
                console.error(
                    "DONOR LOOKUP ERROR:",
                    donorError
                );

                return {
                    profile: null,
                    contact: null
                };
            });
        }


        /* =========================================
           GOOGLE MAPS LINK
        ========================================= */

        const googleMapsURL =
            `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                pickupAddress
            )}`;


        console.log(
            "GOOGLE MAPS URL:",
            googleMapsURL
        );


        /* =========================================
           FIND FOOD CARD
        ========================================= */

        const card =
            document.querySelector(
                `[data-listing-id="${listingId}"]`
            )?.closest(
                ".food-card"
            );


        if (!card) {

            console.error(
                "Food card not found:",
                listingId
            );

            return;

        }


        /* =========================================
           DISPLAY CLAIMED FOOD
        ========================================= */

        card.classList.add(
            "claimed-card"
        );


        card.innerHTML = `

            <div class="claimed-success">

                <div class="success-icon">
                    ✓
                </div>

                <div>

                    <strong>
                        Food successfully claimed
                    </strong>

                    <span>
                        Please collect it from
                        the location below.
                    </span>

                </div>

            </div>


            <div class="claimed-food-name">

                ${escapeHTML(
            foodName
        )}

            </div>


            <div class="contact-details">


                <!-- PICKUP ADDRESS -->

                <div class="contact-row">

                    <span>
                        📍
                    </span>

                    <div>

                        <small>
                            PICKUP ADDRESS
                        </small>

                        <strong>
                            ${escapeHTML(
            pickupAddress
        )}
                        </strong>

                    </div>

                </div>


                <!-- DONOR -->

                <div class="contact-row">

                    <span>
                        👤
                    </span>

                    <div>

                        <small>
                            DONOR
                        </small>

                        <strong data-donor-name>
                            ${escapeHTML(
            donorName
        )}
                        </strong>

                    </div>

                </div>


                <!-- PHONE -->

                <div class="contact-row">

                    <span>
                        📞
                    </span>

                    <div>

                        <small>
                            CONTACT
                        </small>

                        <span data-donor-contact>
                        ${donorPhone
                ? `
                                <a
                                    href="tel:${escapeHTML(
                    donorPhone
                )}"
                                >
                                    ${escapeHTML(
                    donorPhone
                )}
                                </a>
                            `
                : `
                                <strong>
                                    Phone number not available
                                </strong>
                            `
            }
                        </span>

                    </div>

                </div>


            </div>


            <!-- GOOGLE MAPS -->

            ${pickupAddress !==
                "Pickup address not available"
                ? `

                    <a
                        href="${googleMapsURL}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="maps-button"
                    >

                        <span>
                            🗺️
                        </span>

                        <span>
                            Get Directions
                        </span>

                        <span>
                            →
                        </span>

                    </a>

                `
                : ""
            }


            <div class="claimed-note">

                Please collect the food
                responsibly and on time.

            </div>

        `;


        /* =========================================
           UPDATE COUNT
        ========================================= */

        const remaining =
            document.querySelectorAll(
                ".food-card:not(.claimed-card)"
            ).length;


        foodCount.textContent =
            `${remaining} ${remaining === 1
                ? "food listing"
                : "food listings"
            }`;

        donorProfilePromise.then(({ profile, contact }) => {
            const profileData = profile?.exists()
                ? profile.data()
                : {};
            const contactData = contact?.exists()
                ? contact.data()
                : {};

            if (!profile?.exists() && !contact?.exists()) {
                return;
            }

            const updatedName =
                profileData.name ||
                contactData.name ||
                donorName;
            const updatedPhone =
                profileData.phone ||
                profileData.phoneNumber ||
                profileData.contact ||
                contactData.phone ||
                contactData.phoneNumber ||
                contactData.contact ||
                donorPhone;
            const donorNameElement =
                card.querySelector("[data-donor-name]");
            const donorContactElement =
                card.querySelector("[data-donor-contact]");

            if (donorNameElement) {
                donorNameElement.textContent = updatedName;
            }

            if (donorContactElement) {
                donorContactElement.innerHTML = updatedPhone
                    ? `<a href="tel:${escapeHTML(updatedPhone)}">${escapeHTML(updatedPhone)}</a>`
                    : "<strong>Phone number not available</strong>";
            }
        });


        console.log(
            "CLAIMED FOOD DISPLAY COMPLETE"
        );


    } catch (error) {

        console.error(
            "SHOW CLAIMED FOOD ERROR:",
            error
        );

        alert(
            "Food was claimed, but pickup details could not be displayed."
        );

    }

}

/* =========================================
   LOADING
========================================= */

function showLoading() {

    foodContainer.innerHTML = `

        <div class="feed-state">

            <div class="loading-spinner"></div>

            <h3>
                Finding available food...
            </h3>

            <p>
                Looking for surplus food
                shared near you.
            </p>

        </div>

    `;

}


/* =========================================
   EMPTY
========================================= */

function showEmpty() {

    foodContainer.innerHTML = `

        <div class="feed-state">

            <div class="empty-food-icon">
                🍽️
            </div>

            <h3>
                No food available right now
            </h3>

            <p>
                Check back soon.
                New food listings will appear here.
            </p>

        </div>

    `;

}


/* =========================================
   ERROR
========================================= */

function showError(
    message
) {

    foodContainer.innerHTML = `

        <div class="feed-state error-state">

            <div class="empty-food-icon">
                !
            </div>

            <h3>
                Unable to load food
            </h3>

            <p>
                ${escapeHTML(message)}
            </p>

            <button
                id="retryButton"
                class="retry-button">

                Try Again

            </button>

        </div>

    `;


    const retryButton =
        document.getElementById(
            "retryButton"
        );


    if (retryButton) {

        retryButton.addEventListener(
            "click",
            loadAvailableFood
        );

    }

}


/* =========================================
   LOGOUT
========================================= */

if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                await signOut(auth);

                window.location.href =
                    "login.html";

            } catch (error) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );

            }

        }
    );

}


/* =========================================
   SECURITY
========================================= */

function escapeHTML(
    value
) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}