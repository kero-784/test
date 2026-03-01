let currentUser = null;

// Check if user is already logged in on page load
window.onload = () => {
    const storedUser = localStorage.getItem('clinicUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    }
};

async function handleLogin() {
    const username = document.getElementById('login-username').value;
    const code = document.getElementById('login-code').value;
    const errorMsg = document.getElementById('login-error');

    if (!username || !code) {
        errorMsg.textContent = "Please enter both username and code.";
        return;
    }

    // Query the app_users table
    const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', username)
        .eq('login_code', code)
        .single();

    if (error || !data) {
        errorMsg.textContent = "Invalid username or login code.";
    } else {
        if(data.status !== 'Active') {
            errorMsg.textContent = "Account inactive.";
            return;
        }
        currentUser = data;
        localStorage.setItem('clinicUser', JSON.stringify(currentUser));
        showDashboard();
    }
}

function handleLogout() {
    localStorage.removeItem('clinicUser');
    currentUser = null;
    document.getElementById('dashboard-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('login-username').value = '';
    document.getElementById('login-code').value = '';
}

function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard-screen').classList.remove('hidden');
    document.getElementById('user-display').textContent = `${currentUser.full_name} (${currentUser.role})`;
    
    // Initialize Dashboard permissions
    initDashboard();
}