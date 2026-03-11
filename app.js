const API_URL = "api.php";

let nursingTimerInterval = null;
let nursingSeconds = 0;
let isNursingTimerRunning = false;

// פונקציות עזר לזמן
function getCurrentDateTimeLocal() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
}

function formatDateTime(dateString) {
    if (!dateString) return "אין נתונים";
    const date = new Date(dateString);
    return date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

function formatTimeLength(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

// ניהול מודלים (חלונות קופצים)
function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("hidden");
    
    // אנימציית החלקה למעלה
    const content = modal.children[0];
    setTimeout(() => { content.classList.remove("translate-y-full"); }, 10);

    if(id === "bottleModal") document.getElementById("bottle-start").value = getCurrentDateTimeLocal();
    if(id === "pumpingModal") document.getElementById("pumping-start").value = getCurrentDateTimeLocal();
    if(id === "diaperModal") {
        document.getElementById("diaper-start").value = getCurrentDateTimeLocal();
        setDiaperType(""); // איפוס
    }
    if(id === "sleepModal") {
        document.getElementById("sleep-start").value = getCurrentDateTimeLocal();
        document.getElementById("sleep-end").value = getCurrentDateTimeLocal();
    }
}

function closeModal {
    const modal = document.getElementById(id);
    if(!modal) return;
    const content = modal.children[0];
    content.classList.add("translate-y-full");
    setTimeout(() => { modal.classList.add("hidden"); }, 300);
    
    if(id === "nursingModal" && isNursingTimerRunning) {
        console.log("Timer is still running in background");
    }
}

function openNursingModal() {
    openModal("nursingModal");
    if(!isNursingTimerRunning && nursingSeconds === 0) {
        document.getElementById("nursing-start-time").value = getCurrentDateTimeLocal();
    }
}

function toggleNursingTimer() {
    const btn = document.getElementById("btn-start-timer");
    
    if (isNursingTimerRunning) {
        // עצירה
        clearInterval(nursingTimerInterval);
        isNursingTimerRunning = false;
        btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
        btn.classList.replace("bg-yellow-100", "bg-green-100");
        btn.classList.replace("text-yellow-600", "text-green-600");
        btn.classList.replace("border-yellow-200", "border-green-200");
    } else {
        // התחלה
        if(nursingSeconds === 0) document.getElementById("nursing-start-time").value = getCurrentDateTimeLocal();
        isNursingTimerRunning = true;
        btn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
        btn.classList.replace("bg-green-100", "bg-yellow-100");
        btn.classList.replace("text-green-600", "text-yellow-600");
        btn.classList.replace("border-green-200", "border-yellow-200");
        
        nursingTimerInterval = setInterval(() => {
            nursingSeconds++;
            document.getElementById("nursing-timer-display").textContent = formatTimeLength(nursingSeconds);
        }, 1000);
    }
}

function resetNursingTimer() {
    clearInterval(nursingTimerInterval);
    isNursingTimerRunning = false;
    nursingSeconds = 0;
    document.getElementById("nursing-timer-display").textContent = "00:00";
    
    const btn = document.getElementById("btn-start-timer");
    btn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    btn.classList.remove("bg-yellow-100", "text-yellow-600", "border-yellow-200");
    btn.classList.add("bg-green-100", "text-green-600", "border-green-200");
}

function setNursingSide(side) {
    document.getElementById("nursing-side").value = side;
    
    // איפוס עיצוב כפתורים
    ["left", "both", "right"].forEach(s => {
        const btn = document.getElementById("btn-side-" + s);
        btn.className = "flex-1 py-2 border rounded-xl font-medium text-gray-600 bg-gray-50 transition";
    });
    
    // הדגשת הנבחר
    const activeBtn = document.getElementById("btn-side-" + side);
    activeBtn.className = "flex-1 py-2 border rounded-xl font-bold bg-blue-50 border-blue-300 text-blue-700 shadow-sm transition transform scale-105";
}

function setDiaperType(type) {
    document.getElementById("diaper-type").value = type;
    
    ["pee", "poop", "both"].forEach(t => {
        const btn = document.getElementById("btn-diaper-" + t);
        if(btn) btn.classList.replace("bg-orange-50", "bg-gray-50");
        if(btn) btn.classList.replace("border-orange-300", "border-gray-200");
    });
    
    if(type) {
        const activeBtn = document.getElementById("btn-diaper-" + type);
        activeBtn.classList.replace("bg-gray-50", "bg-orange-50");
        activeBtn.classList.replace("border-gray-200", "border-orange-300");
    }
}

// שמירת נתונים
async function saveNursing() {
    const timeValue = document.getElementById("nursing-start-time").value || getCurrentDateTimeLocal();
    const data = {
        type: "nursing",
        start_time: timeValue,
        side: document.getElementById("nursing-side").value,
        notes: `משך: ${formatTimeLength(nursingSeconds)}`
    };
    
    await sendPostRequest("add_feeding", data);
    resetNursingTimer();
    closeModal("nursingModal");
}

async function saveBottle() {
    const data = {
        type: "bottle",
        start_time: document.getElementById("bottle-start").value,
        amount_ml: document.getElementById("bottle-amount").value,
    };
    if(!data.amount_ml) { alert("יש להזין כמות!"); return; }
    await sendPostRequest("add_feeding", data);
    closeModal("bottleModal");
}

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

async function saveDiaper() {
    const data = {
        time: document.getElementById("diaper-start").value,
        type: document.getElementById("diaper-type").value
    };
    if(!data.type) { alert("יש לבחור סוג יציאה!"); return; }
    await sendPostRequest("add_diaper", data);
    closeModal("diaperModal");
}

async function saveSleep() {
    const data = {
        start_time: document.getElementById("sleep-start").value,
        end_time: document.getElementById("sleep-end").value
    };
    if(!data.start_time || !data.end_time) { alert("יש להזין זמני התחלה וסיום!"); return; }
    await sendPostRequest("add_sleep", data);
    closeModal("sleepModal");
}

async function deleteRecord(table, id) {
    if(confirm("למחוק את הרשומה הזו?")) {
        await sendPostRequest("delete_record", { table, id });
    }
}

// קריאה מהשרת
async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}?action=get_dashboard_data`);
        const data = await response.json();
        
        document.getElementById("dash-pumped").textContent = `${data.today_pumped_ml || 0} מ"ל`;
        document.getElementById("dash-bottle").textContent = `${data.today_bottle_ml || 0} מ"ל`;
        if(document.getElementById("dash-nursing-count")) document.getElementById("dash-nursing-count").textContent = data.today_nursing_count || 0;
        if(document.getElementById("dash-nursing-avg")) document.getElementById("dash-nursing-avg").textContent = data.today_nursing_avg_time || "00:00";

        let lastFeedText = "אין נתונים היום";
        if (data.last_feeding) {
            let typeText = data.last_feeding.type === "nursing" ? "הנקה" : `בקבוק (${data.last_feeding.amount_ml} מ"ל)`;
            lastFeedText = `${formatDateTime(data.last_feeding.start_time)} - ${typeText}`;
        }
        document.getElementById("dash-last-feed").textContent = lastFeedText;

        let lastPumpText = "אין נתונים היום";
        if (data.last_pumping) {
            lastPumpText = `${formatDateTime(data.last_pumping.start_time)} - ${data.last_pumping.amount_ml} מ"ל`;
        }
        document.getElementById("dash-last-pump").textContent = lastPumpText;
        
        let lastSleepText = "אין נתונים היום";
        if (data.last_sleep) {
            lastSleepText = `${formatDateTime(data.last_sleep.start_time)} עד ${formatDateTime(data.last_sleep.end_time)}`;
        }
        if(document.getElementById("dash-last-sleep")) document.getElementById("dash-last-sleep").textContent = lastSleepText;
        if(document.getElementById("dash-sleep-total")) document.getElementById("dash-sleep-total").textContent = data.today_sleep_time || "0 דקות";

        renderHistory(data.recent_history || []);

    } catch (error) {
        console.error("Error loading dashboard:", error);
    }
}

function renderHistory(historyArray) {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    const sleepList = document.getElementById("sleep-history-list");
    sleepList.innerHTML = "";

    let hasGeneral = false;
    let hasSleep = false;

    

    historyArray.forEach(item => {
        let icon = "", title = "", details = "", colorClass = "";
        const timeStr = formatDateTime(item.time);

        if(item.table_name === "feedings") {
            if(item.event_type === "nursing") {
                icon = "fa-person-breastfeeding"; title = "הנקה"; colorClass = "text-blue-500 bg-blue-50";
                details = `צד: ${item.side === "left" ? "שמאל" : item.side === "right" ? "ימין" : "שניהם"}`;
            } else {
                icon = "fa-bottle-droplet"; title = "בקבוק"; colorClass = "text-green-500 bg-green-50";
                details = `${item.amount_ml} מ"ל`;
            }
        } else if(item.table_name === "pumpings") {
            icon = "fa-pump-medical"; title = "שאיבה"; colorClass = "text-purple-500 bg-purple-50";
            details = `${item.amount_ml} מ"ל`;
        } else if(item.table_name === "diapers") {
            icon = "fa-baby-carriage"; title = "טיטול"; colorClass = "text-orange-500 bg-orange-50";
            let dType = item.event_type === "pee" ? "פיפי 💧" : item.event_type === "poop" ? "קקי 💩" : "שניהם ✌️";
            details = dType;
        } else if(item.table_name === "sleeps") {
            icon = "fa-moon"; title = "שינה"; colorClass = "text-indigo-500 bg-indigo-50";
            const sStart = new Date(item.time);
            const sEnd = new Date(item.end_time);
            const diffMins = Math.round((sEnd - sStart) / 60000);
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            let timeStrDiff = h > 0 ? `${h} שעות ו-${m} דקות` : `${m} דקות`;
            details = `${formatDateTime(item.time)} עד ${formatDateTime(item.end_time)} (${timeStrDiff})`;
        }

        
        const htmlStr = `
            <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-100 shadow-sm mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center ${colorClass}">
                        <i class="fa-solid ${icon}"></i>
                    </div>
                    <div>
                        <p class="font-bold text-gray-800 leading-tight">${title}</p>
                        <p class="text-xs text-gray-500">${timeStr} • ${details}</p>
                    </div>
                </div>
                <button onclick="deleteRecord('${item.table_name}', ${item.id})" class="text-gray-300 hover:text-red-500 p-2"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        if(item.table_name === "sleeps") {
            sleepList.innerHTML += htmlStr;
            hasSleep = true;
        } else {
            list.innerHTML += htmlStr;
            hasGeneral = true;
        }
        
    });
    if(!hasGeneral) list.innerHTML = `<p class="text-center text-gray-400 text-sm py-4">לא הוזנו נתוני תזונה/טיטולים היום</p>`;
    if(!hasSleep) sleepList.innerHTML = `<p class="text-center text-gray-400 text-sm py-4">לא הוזנו נתוני שינה היום</p>`;
}

async function sendPostRequest(action, data) {
    try {
        const response = await fetch(`${API_URL}?action=${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            loadDashboard();
        } else {
            alert("שגיאה: " + result.error);
        }
    } catch (error) {
        console.error("Error saving data:", error);
    }
}

document.addEventListener("DOMContentLoaded", loadDashboard);

// Scroll to top button logic
window.addEventListener("scroll", () => {
    const scrollBtn = document.getElementById("btn-scroll-up");
    if(!scrollBtn) return;
    if (window.scrollY > 200) {
        scrollBtn.classList.remove("opacity-0", "translate-y-10", "pointer-events-none");
    } else {
        scrollBtn.classList.add("opacity-0", "translate-y-10", "pointer-events-none");
    }
});















