const USER_CREDITS_KEY = 'imagen_userCredits';

const packageNameEl = document.getElementById('package-name') as HTMLElement;
const packagePriceEl = document.getElementById('package-price') as HTMLElement;
const packageCreditsEl = document.getElementById('package-credits') as HTMLElement;
const payNowButton = document.getElementById('pay-now-button') as HTMLButtonElement;
const cancelButton = document.getElementById('cancel-button') as HTMLButtonElement;

let returnUrl = 'index.html'; // Default fallback
let creditsToAdd = 0;

function initializePaymentPage() {
    const purchaseDataString = sessionStorage.getItem('pendingPurchase');
    if (!purchaseDataString) {
        alert('No purchase data found. Returning home.');
        window.location.href = 'index.html';
        return;
    }

    try {
        const purchaseData = JSON.parse(purchaseDataString);
        creditsToAdd = purchaseData.credits;
        returnUrl = purchaseData.returnUrl || 'index.html';

        if (packageNameEl) packageNameEl.textContent = purchaseData.name;
        if (packagePriceEl) packagePriceEl.textContent = purchaseData.price;
        if (packageCreditsEl) packageCreditsEl.textContent = `${purchaseData.credits} Video Credits`;

    } catch (e) {
        console.error('Failed to parse purchase data:', e);
        alert('Invalid purchase data. Returning home.');
        window.location.href = 'index.html';
    }
}

async function handlePayment() {
    if (!payNowButton) return;

    payNowButton.disabled = true;
    payNowButton.textContent = 'Processing...';

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
        // Update credits in localStorage
        const currentCredits = parseInt(localStorage.getItem(USER_CREDITS_KEY) || '0', 10);
        const newCredits = currentCredits + creditsToAdd;
        localStorage.setItem(USER_CREDITS_KEY, newCredits.toString());

        // Signal success for the return page
        sessionStorage.setItem('purchaseStatus', 'success');
        sessionStorage.setItem('creditsAdded', creditsToAdd.toString());
        sessionStorage.removeItem('pendingPurchase'); // Clean up

        window.location.href = returnUrl;
    } catch (e) {
        console.error('Failed to process payment:', e);
        alert('An error occurred during payment. Please try again.');
        payNowButton.disabled = false;
        payNowButton.textContent = 'Pay Now';
    }
}

function handleCancel() {
    sessionStorage.removeItem('pendingPurchase');
    window.location.href = returnUrl;
}

document.addEventListener('DOMContentLoaded', () => {
    initializePaymentPage();
    if (payNowButton) payNowButton.addEventListener('click', handlePayment);
    if (cancelButton) cancelButton.addEventListener('click', handleCancel);
});
