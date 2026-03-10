const API_URL = "api.php";

// פונקציית עזר לעיצוב תאריך נוכחי עבור אינפוט מסוג datetime-local
function getCurrentDateTimeLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

// פונקציית עזר לעיצוב תצוגת תאריך למשתמש
function formatDateTime(dateString) {
    if (!dateString) return "אין נתונים";
    const options = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };
    return new Date(dateString).toLocaleDateString("he-IL", options);
}

// ניהול מודלים (חלונות קופצים)
function openModal(id) {
    document.getElementById(id).classList.remove("hidden");
    // אתחול שעה נוכחית
    if(id === "nursingModal") document.getElementById("nursing-start").value = getCurrentDateTimeLocal();
    if(id === "bottleModal") document.getElementById("bottle-start").value = getCurrentDateTimeLocal();
    if(id === "pumpingModal") document.getElementById("pumping-start").value = getCurrentDateTimeLocal();
}

function closeModal(id) {
    document.getElementById(id).classList.add("hidden");
}

// קריאה לנתוני הדשבורד מהשרת
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}?action=get_dashboard_data`);
        const data = await response.json();
        
        document.getElementById("dash-pumped").textContent = `${data.today_pumped_ml || 0} מ"ל`;
        document.getElementById("dash-bottle").textContent = `${data.today_bottle_ml || 0} מ"ל`;

        let lastFeedText = "אין נתונים";
        if (data.last_feeding) {
            let typeText = data.last_feeding.type === "nursing" ? "הנקה" : `בקבוק (${data.last_feeding.amount_ml} מ"ל)`;
            lastFeedText = `${formatDateTime(data.last_feeding.start_time)} - ${typeText}`;
        }
        document.getElementById("dash-last-feed").textContent = lastFeedText;

        let lastPumpText = "אין נתונים";
        if (data.last_pumping) {
            lastPumpText = `${formatDateTime(data.last_pumping.start_time)} - ${data.last_pumping.amount_ml} מ"ל`;
        }
        document.getElementById("dash-last-pump").textContent = lastPumpText;

    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

// שמירת הנקה
async function saveNursing() {
    const data = {
        type: "nursing",
        start_time: document.getElementById("nursing-start").value,
        side: document.getElementById("nursing-side").value,
        notes: document.getElementById("nursing-notes").value
    };
    
    await sendPostRequest("add_feeding", data);
    closeModal("nursingModal");
}

// שמירת בקבוק
async function saveBottle() {
    const data = {
        type: "bottle",
        start_time: document.getElementById("bottle-start").value,
        amount_ml: document.getElementById("bottle-amount").value,
        notes: document.getElementById("bottle-notes").value
    };
    
    if(!data.amount_ml) { alert("יש להזין כמות!"); return; }

    await sendPostRequest("add_feeding", data);
    closeModal("bottleModal");
}

// שמירת שאיבה
async function savePumping() {
    const data = {
        start_time: document.getElementById("pumping-start").value,
        side: document.getElementById("pumping-side").value,
        amount_ml: document.getElementById("pumping-amount").value
    };
    
    if(!data.amount_ml) { alert("יש להזין כמות!"); return; }

    await sendPostRequest("add_pumping", data);
    closeModal("pumpingModal");
}

// פונקציית עזר לשליחת POST
async function sendPostRequest(action, data) {
    try {
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        
        if (result.success) {
            // רענון הדשבורד לאחר שמירה מוצלחת
            loadDashboard();
        } else {
            alert("שגיאה בשמירת הנתונים: " + result.error);
        }
    } catch (error) {
        console.error("Error saving data:", error);
        alert("שגיאת תקשורת עם השרת");
    }
}

// הפעלת טעינת הדשבורד עם עליית העמוד
document.addEventListener("DOMContentLoaded", loadDashboard);
