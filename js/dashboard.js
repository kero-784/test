// Define all system modules and which roles can access them
const SYSTEM_MODULES =[
    { id: 'patients', title: 'Patient Management', roles: ['Admin', 'Doctor', 'Receptionist', 'Nurse'], script: 'modules/patients.js' },
    { id: 'appointments', title: 'Appointments', roles:['Admin', 'Doctor', 'Receptionist'], script: 'modules/appointments.js' },
    { id: 'consultation', title: 'Consultations', roles: ['Admin', 'Doctor'], script: 'modules/consultation.js' },
    { id: 'billing', title: 'Billing & Invoicing', roles:['Admin', 'Accountant', 'Receptionist'], script: 'modules/billing.js' }
];

// Currently loaded scripts
const loadedScripts = {};

function initDashboard() {
    const navList = document.getElementById('sidebar-nav');
    navList.innerHTML = '';

    // Filter modules based on current user's role
    const permittedModules = SYSTEM_MODULES.filter(mod => mod.roles.includes(currentUser.role));

    permittedModules.forEach(mod => {
        const li = document.createElement('li');
        li.textContent = mod.title;
        li.onclick = () => loadModule(mod);
        navList.appendChild(li);
    });
}

function loadModule(moduleConfig) {
    // Clear horizontal tabs and container
    document.getElementById('horizontal-tabs').innerHTML = '';
    document.getElementById('module-container').innerHTML = '<h2>Loading...</h2>';

    // If script already loaded, just initialize it
    if (loadedScripts[moduleConfig.id]) {
        window[`init_${moduleConfig.id}`](currentUser);
        return;
    }

    // Dynamically inject the standalone Javascript file for the module
    const script = document.createElement('script');
    script.src = moduleConfig.script;
    script.onload = () => {
        loadedScripts[moduleConfig.id] = true;
        // Every module MUST expose an init_moduleId(user) function globally
        window[`init_${moduleConfig.id}`](currentUser);
    };
    document.body.appendChild(script);
}