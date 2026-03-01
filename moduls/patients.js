// Standalone module for Patients
// Exposes init_patients to the global scope so dashboard.js can call it.

window.init_patients = function(user) {
    setupPatientTabs();
    loadPatientList(); // Default view
};

// 1. Setup Secondary Horizontal Tabs
function setupPatientTabs() {
    const tabsContainer = document.getElementById('horizontal-tabs');
    tabsContainer.innerHTML = `
        <button class="tab-btn active" id="tab-patient-list" onclick="window.patientsModule.showList()">Patient List</button>
        <button class="tab-btn" id="tab-patient-add" onclick="window.patientsModule.showAddForm()">Register Patient</button>
    `;
}

// 2. Namespace internal functions to avoid polluting global scope
window.patientsModule = {
    showList: async function() {
        document.getElementById('tab-patient-list').classList.add('active');
        document.getElementById('tab-patient-add').classList.remove('active');
        await loadPatientList();
    },

    showAddForm: function() {
        document.getElementById('tab-patient-add').classList.add('active');
        document.getElementById('tab-patient-list').classList.remove('active');
        
        const container = document.getElementById('module-container');
        container.innerHTML = `
            <h2>Register New Patient</h2>
            <div style="max-width: 500px; background: #fff; padding: 20px; border-radius: 8px;">
                <div class="form-group"><label>First Name</label><input type="text" id="p-fname"></div>
                <div class="form-group"><label>Last Name</label><input type="text" id="p-lname"></div>
                <div class="form-group"><label>Date of Birth</label><input type="date" id="p-dob"></div>
                <div class="form-group"><label>Phone</label><input type="text" id="p-phone"></div>
                <button onclick="window.patientsModule.savePatient()" style="padding: 10px; background: #2ecc71; color: #fff; border:none; border-radius:4px;">Save Patient</button>
            </div>
        `;
    },

    savePatient: async function() {
        const fname = document.getElementById('p-fname').value;
        const lname = document.getElementById('p-lname').value;
        const dob = document.getElementById('p-dob').value;
        const phone = document.getElementById('p-phone').value;

        if(!fname || !lname || !dob) return alert("Name and DOB required!");

        const { data, error } = await supabase.from('patients').insert([
            { first_name: fname, last_name: lname, dob: dob, phone: phone }
        ]);

        if (error) {
            alert("Error saving patient: " + error.message);
        } else {
            alert("Patient Registered!");
            this.showList();
        }
    }
};

// 3. Database Fetch Logic
async function loadPatientList() {
    const container = document.getElementById('module-container');
    container.innerHTML = '<h2>Patient List</h2><p>Fetching data...</p>';

    const { data, error } = await supabase.from('patients').select('*').order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        return;
    }

    let html = `
        <table id="patients-table">
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Phone</th>
                <th>Action</th>
            </tr>
    `;

    data.forEach(p => {
        // Auto Calculate Age
        const age = new Date().getFullYear() - new Date(p.dob).getFullYear();
        html += `
            <tr>
                <td>P-${p.patient_uid}</td>
                <td>${p.first_name} ${p.last_name}</td>
                <td>${age}</td>
                <td>${p.phone || 'N/A'}</td>
                <td><button onclick="alert('View history logic here')">View</button></td>
            </tr>
        `;
    });
    html += `</table>`;
    container.innerHTML = html;
}