import { db } from "./firebase.js";

import {
    collection,
    onSnapshot,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


const liveStatus = document.getElementById("liveStatus");
const liveTime = document.getElementById("liveTime");
const liveFoodName = document.getElementById("liveFoodName");
const liveFoodQuantity = document.getElementById("liveFoodQuantity");
const liveFoodLocation = document.getElementById("liveFoodLocation");
const liveDonorName = document.getElementById("liveDonorName");
const liveListingStatus = document.getElementById("liveListingStatus");


subscribeToAvailableFood();


function subscribeToAvailableFood() {

    onSnapshot(
        query(
            collection(db, "listings"),
            where("status", "==", "Available")
        ),
        (snapshot) => {

            const availableListings = snapshot.docs
                .map((listingDocument) => ({
                    id: listingDocument.id,
                    ...listingDocument.data()
                }))
                .filter((listing) =>
                    String(listing.status || "").toLowerCase() === "available"
                )
                .sort((firstListing, secondListing) =>
                    getTimestamp(secondListing.createdAt) -
                    getTimestamp(firstListing.createdAt)
                );

            const newestListing = availableListings[0];

            if (!newestListing) {
                showEmptyState();
                return;
            }

            renderListing(newestListing);
        },
        (error) => {
            console.error("LANDING LISTINGS ERROR:", error);
            showUnavailableState();
        }
    );
}


function renderListing(listing) {

    const foodName = listing.foodItem || listing.foodName || "Fresh food nearby";
    const quantity = listing.quantity || "Available for pickup";
    const donorName =
        listing.donorName ||
        listing.donor ||
        listing.name ||
        "Food donor";

    liveStatus.textContent = "LIVE NEAR YOU";
    liveTime.textContent = formatTime(listing.createdAt);
    liveFoodName.textContent = foodName;
    liveFoodQuantity.textContent = `${quantity} available in your local circle`;
    liveFoodLocation.innerHTML =
        "<span>●</span> Pickup details unlock after login and claim";
    liveDonorName.textContent = `Shared by: ${donorName}`;
    liveListingStatus.href = "login.html";
    liveListingStatus.textContent = "Claimable now ->";
}


function showEmptyState() {

    liveStatus.textContent = "READY FOR YOUR NEXT SHARE";
    liveTime.textContent = "LIVE";
    liveFoodName.textContent = "Your neighbourhood is waiting";
    liveFoodQuantity.textContent = "Be the first donor to put fresh food on the map";
    liveFoodLocation.innerHTML = "<span>●</span> Pickup details unlock after login and claim";
    liveDonorName.textContent = "Start a local food signal";
    liveListingStatus.href = "register.html";
    liveListingStatus.textContent = "Share food ->";
}


function showUnavailableState() {

    liveStatus.textContent = "FOOD SIGNAL PAUSED";
    liveTime.textContent = "OFFLINE";
    liveFoodName.textContent = "Live listings are taking a moment";
    liveFoodQuantity.textContent = "Please check back soon for nearby food";
    liveFoodLocation.innerHTML = "<span>●</span> Pickup details unlock after login and claim";
    liveDonorName.textContent = "FoodShare Local";
    liveListingStatus.href = "login.html";
    liveListingStatus.textContent = "Try again soon";
}


function getTimestamp(value) {

    if (!value) {
        return 0;
    }

    if (typeof value.toMillis === "function") {
        return value.toMillis();
    }

    return new Date(value).getTime() || 0;
}


function formatTime(value) {

    const timestamp = getTimestamp(value);

    if (!timestamp) {
        return "JUST NOW";
    }

    return new Intl.DateTimeFormat([], {
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(timestamp));
}


function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
