// =================================================================
// --- SUPABASE INITIALIZATION ---
// =================================================================
        
const SUPABASE_URL = 'https://jamvpcsstzxrlooksrjs.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphbXZwY3NzdHp4cmxvb2tzcmpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2OTQwODQsImV4cCI6MjA3MzI3MDA4NH0.OZNUOmBgEPdFeKxZbsa6PyV8w0vMZxsVMBuzPAAm5X8';

const { createClient } = supabase;
const dbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =================================================================
// --- GLOBAL STATE AND NAVIGATION ---
// =================================================================
        
let appState = {
    user: {
        firstName: '',
        id: null,
        email: null,
    },
    onboardingProfile: {},
    pendingUpdate: {}
};

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}
        
function goBack(currentPage) {
    if (currentPage === 'dashboard') {
        alert("You will now be taken back to edit your preferences.");
        showPage('onboardingPage');
    } else if (currentPage === 'onboarding') {
        if (confirm("Are you sure? This will log you out.")) {
            onboarding_reset();
            dbClient.auth.signOut();
            showPage('loginSignupPage');
        }
    }
}

function showLoading(button, text = 'Processing...') {
    const originalText = button.textContent;
    button.innerHTML = `<span class="loading"></span>${text}`;
    button.disabled = true;
    return () => {
        button.textContent = originalText;
        button.disabled = false;
    };
}

// =================================================================
// --- AUTH & ONBOARDING ---
// =================================================================
        
function auth_switchTab(tab, event) {
    event.preventDefault();
    document.querySelectorAll('#loginSignupPage .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('#loginSignupPage .form').forEach(form => form.classList.remove('active'));
    document.getElementById(tab + 'Form').classList.add('active');
    const switchText = document.getElementById('switchText');
    if (tab === 'login') {
        switchText.innerHTML = 'Don\'t have an account? <a href="#" class="switch-form" onclick="auth_switchTab(\'signup\', event)">Sign up here</a>';
    } else {
        switchText.innerHTML = 'Already have an account? <a href="#" class="switch-form" onclick="auth_switchTab(\'login\', event)">Sign in here</a>';
    }
}
function auth_togglePassword(fieldId, event) {
    const field = document.getElementById(fieldId);
    const button = event.target;
    if (field.type === 'password') {
        field.type = 'text';
        button.textContent = '🙈';
    } else {
        field.type = 'password';
        button.textContent = '👁';
    }
}
function auth_validatePassword(password) { return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password); }
        
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const restoreBtn = showLoading(this.querySelector('.submit-btn'));
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        const { data: profile, error: profileError } = await dbClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            throw profileError;
        }

        if (!profile || !profile.learning_style) { // learning_style is a good indicator of completed onboarding
            appState.user.firstName = (profile && profile.first_name) || "User";
            showPage('onboardingPage');
            return;
        }

        const today = new Date();
        const lastLogin = new Date(profile.last_login);
        const isNewDay = today.toDateString() !== lastLogin.toDateString();

        if (isNewDay) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            let newStreak = profile.current_streak || 0;
            if (lastLogin.toDateString() === yesterday.toDateString()) {
                newStreak++;
                alert(`You've continued your streak! It's now ${newStreak} days! 🔥`);
            } else {
                newStreak = 1;
                alert("Welcome back! You've started a new 1-day streak! 👍");
            }

            appState.pendingUpdate = {
                id: profile.id,
                current_streak: newStreak,
                last_login: today.toISOString()
            };
            
            appState.onboardingProfile = profile;

            dailyMood_showModal();

        } else {
            appState.user.firstName = profile.first_name || "User";
            appState.onboardingProfile = profile;
            initializeDashboard();
            showPage('dashboardPage');
        }

    } catch (error) {
        alert('Login failed: ' + error.message);
    } finally {
        restoreBtn();
    }
});
        
document.getElementById('signupForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const password = document.getElementById('signupPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const passwordError = document.getElementById('signupPasswordError');
    const confirmError = document.getElementById('confirmPasswordError');
    let hasErrors = false;
    passwordError.style.display = 'none';
    confirmError.style.display = 'none';
    if (!auth_validatePassword(password)) {
        passwordError.style.display = 'block';
        hasErrors = true;
    }
    if (password !== confirm) {
        confirmError.textContent = 'Passwords do not match';
        confirmError.style.display = 'block';
        hasErrors = true;
    }
    if (hasErrors) return;
    
    const restoreBtn = showLoading(this.querySelector('.submit-btn'));
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('signupEmail').value;

    try {
        const { data, error } = await dbClient.auth.signUp({
            email: email,
            password: password,
            options: { data: { first_name: firstName, last_name: lastName } }
        });

        if (error) throw error;

        appState.user.firstName = firstName;
        document.getElementById('successMessage').textContent = "🎉 Account created successfully! You can now log in."
        document.getElementById('successMessage').style.display = 'block';
        
        document.getElementById('signupForm').reset();
        setTimeout(() => {
            document.querySelector('.tab-btn[onclick*="login"]').click();
            document.getElementById('successMessage').style.display = 'none';
        }, 4000); 

    } catch (error) {
        alert('Sign up failed: ' + error.message);
    } finally {
        restoreBtn();
    }
});
        
let onboarding_currentStep = 0;
const onboarding_totalSteps = 5;
const onboarding_userProfile = { 
    educationLevel: null,
    institutionName: '',
    city: '',
    state: '',
    learningStyle: null,
    confidentSubjects: [],
    challengingSubjects: []
};

function onboarding_reset() {
    Object.keys(onboarding_userProfile).forEach(key => {
        if (Array.isArray(onboarding_userProfile[key])) {
            onboarding_userProfile[key] = [];
        } else if (typeof onboarding_userProfile[key] === 'string') {
            onboarding_userProfile[key] = '';
        } else {
            onboarding_userProfile[key] = null;
        }
    });
    document.querySelectorAll('#onboardingPage .selected').forEach(el => el.classList.remove('selected'));
    document.getElementById('institutionName').value = '';
    document.getElementById('city').value = '';
    document.getElementById('state').value = '';
    onboarding_setActiveStep(0);
}

function onboarding_setActiveStep(index) {
    if (index < 0 || index >= onboarding_totalSteps) return;
    document.querySelectorAll('.onboarding-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`step${index}`).classList.add('active');
    document.querySelectorAll('.progress-dot').forEach((dot, i) => {
        dot.classList.remove('active', 'completed');
        if (i < index) dot.classList.add('completed');
    });
    document.getElementById(`dot${index}`).classList.add('active');
    onboarding_currentStep = index;
    document.getElementById('currentStep').textContent = onboarding_currentStep + 1;
    document.getElementById('prevBtn').disabled = onboarding_currentStep === 0;
    document.getElementById('nextBtn').textContent = onboarding_currentStep === onboarding_totalSteps - 2 ? 'Finish' : 'Next →';
    
    if (onboarding_currentStep === onboarding_totalSteps - 1) { // Summary step
        document.getElementById('navigation').style.display = 'none';
        onboarding_populateSummary();
    } else {
        document.getElementById('navigation').style.display = 'flex';
    }
    onboarding_updateNextButton();
}

function onboarding_jumpToStep(step) {
    if (step < onboarding_currentStep) {
        onboarding_setActiveStep(step);
    }
}

function onboarding_selectEducationLevel(el, level) {
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        onboarding_userProfile.educationLevel = null;
    } else {
        document.querySelectorAll('#step0 .option-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        onboarding_userProfile.educationLevel = level;
    }
    onboarding_updateNextButton();
}

let autocomplete_timeout;
function onboarding_handleInstitutionInput(event) {
    const input = event.target.value;
    onboarding_userProfile.institutionName = input;
    clearTimeout(autocomplete_timeout);
    
    if (input.length < 3) {
        document.getElementById('autocomplete-list').innerHTML = '';
        return;
    }
    
    autocomplete_timeout = setTimeout(() => {
        fetch(`http://universities.hipolabs.com/search?name=${input}`)
            .then(response => response.json())
            .then(data => {
                let suggestionsHTML = '';
                const suggestions = data.slice(0, 5);
                suggestions.forEach(uni => {
                    const safeName = uni.name.replace(/'/g, "\\'");
                    const safeState = (uni['state-province'] || '').replace(/'/g, "\\'");
                    suggestionsHTML += `<div onclick="onboarding_selectInstitution('${safeName}', '${safeState}')">${uni.name}</div>`;
                });
                document.getElementById('autocomplete-list').innerHTML = suggestionsHTML;
            });
    }, 300);
    onboarding_updateNextButton();
}

function onboarding_selectInstitution(name, state) {
    document.getElementById('institutionName').value = name;
    if (state) {
        document.getElementById('state').value = state;
    }
    document.getElementById('autocomplete-list').innerHTML = '';
    onboarding_userProfile.institutionName = name;
    onboarding_updateNextButton();
}

function onboarding_selectLearningStyle(el, style) {
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        onboarding_userProfile.learningStyle = null;
    } else {
        document.querySelectorAll('#step2 .option-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        onboarding_userProfile.learningStyle = style;
    }
    onboarding_updateNextButton();
}

function onboarding_toggleSubject(el, type) {
    const subject = el.dataset.subject;
    const otherType = type === 'confident' ? 'challenging' : 'confident';
    const otherGrid = document.querySelector(`#onboardingPage .subjects-grid [data-subject="${subject}"]:not([onclick*="'${type}'"])`);
    if (el.classList.contains('selected') === false && otherGrid.classList.contains('selected')) {
        alert(`You've already selected ${subject} as a ${otherType} subject.`);
        return;
    }
    el.classList.toggle('selected');
    const list = onboarding_userProfile[type + 'Subjects'];
    if (el.classList.contains('selected')) {
        if (!list.includes(subject)) list.push(subject);
    } else {
        onboarding_userProfile[type + 'Subjects'] = list.filter(s => s !== subject);
    }
    onboarding_updateNextButton();
}

function onboarding_updateNextButton() {
    const nextBtn = document.getElementById('nextBtn');
    let canProceed = false;
    switch (onboarding_currentStep) {
        case 0: canProceed = !!onboarding_userProfile.educationLevel; break;
        case 1: canProceed = document.getElementById('institutionName').value.trim() !== ''; break;
        case 2: canProceed = !!onboarding_userProfile.learningStyle; break;
        case 3: canProceed = (onboarding_userProfile.confidentSubjects.length > 0 || onboarding_userProfile.challengingSubjects.length > 0); break;
        default: canProceed = true;
    }
    nextBtn.disabled = !canProceed;
}

function onboarding_nextStep() {
    if (document.getElementById('nextBtn').disabled) return;
    onboarding_setActiveStep(onboarding_currentStep + 1);
}

function onboarding_previousStep() {
    onboarding_setActiveStep(onboarding_currentStep - 1);
}

function onboarding_populateSummary() {
    const summary = document.getElementById('summaryCards');
    onboarding_userProfile.institutionName = document.getElementById('institutionName').value;
    onboarding_userProfile.city = document.getElementById('city').value;
    onboarding_userProfile.state = document.getElementById('state').value;
    
    const card = (title, value) => `<div style="background:var(--glass-bg-dark); border: 1px solid var(--glass-border-dark); border-radius:12px;padding:12px;box-shadow:0 6px 18px rgba(0,0,0,0.1);font-weight:700"><div style='font-size:0.85rem;color:var(--text-secondary-dark);margin-bottom:8px'>${title}</div><div style='font-size:1rem;color:var(--text-primary-dark)'>${value}</div></div>`;
    
    summary.innerHTML = card('Education Level', onboarding_userProfile.educationLevel || '—') +
        card('Institution', onboarding_userProfile.institutionName || '—') +
        card('Learning Style', onboarding_userProfile.learningStyle || '—') +
        card('Confident', onboarding_userProfile.confidentSubjects.join(', ') || 'None');
}

async function finishOnboarding() {
    const { data: { user } } = await dbClient.auth.getUser();
    if (!user) {
        alert("You are not logged in. Redirecting to login page.");
        showPage('loginSignupPage');
        return;
    }
    
    const updates = {
        id: user.id,
        education_level: onboarding_userProfile.educationLevel,
        institution_name: document.getElementById('institutionName').value,
        city: document.getElementById('city').value,
        state: document.getElementById('state').value,
        learning_style: onboarding_userProfile.learningStyle,
        confident_subjects: onboarding_userProfile.confidentSubjects,
        challenging_subjects: onboarding_userProfile.challengingSubjects,
        last_login: new Date().toISOString(), // Officially start the clock
        updated_at: new Date(),
    };

    try {
        const { error } = await dbClient.from('profiles').upsert(updates, { onConflict: 'id' });
        if (error) throw error;
        
        alert("Onboarding complete! Your daily login streak starts now. Come back tomorrow to continue it!");

        appState.onboardingProfile = { ...appState.onboardingProfile, ...updates };
        initializeDashboard();
        showPage('dashboardPage');
    } catch (error) {
        alert("Could not save your preferences: " + error.message);
    }
}
        
// --- DAILY MOOD FUNCTIONS ---
function dailyMood_showModal() {
    document.getElementById('dailyMoodModalOverlay').style.display = 'flex';
}

function dailyMood_hideModal() {
    document.getElementById('dailyMoodModalOverlay').style.display = 'none';
}

async function dailyMood_selectMood(mood) {
    appState.pendingUpdate.mood = mood;

    try {
        const { data, error } = await dbClient
            .from('profiles')
            .upsert(appState.pendingUpdate)
            .select()
            .single();

        if (error) throw error;

        appState.onboardingProfile = data;
        appState.user.firstName = data.first_name || "User";

        dailyMood_hideModal();
        initializeDashboard();
        showPage('dashboardPage');

    } catch (error) {
        alert("Could not update your mood: " + error.message);
    }
}
        
// =================================================================
// --- DASHBOARD & INTERACTIVITY SCRIPTS ---
// =================================================================
function initializeDashboard() {
    const user = appState.user;
    const profile = appState.onboardingProfile;
    const hour = new Date().getHours();
    let greeting = 'Good Morning';
    if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
    else if (hour >= 17) greeting = 'Good Evening';
    document.querySelector('#dashboardPage .welcome-title').textContent = `${greeting}, ${user.firstName}! 👋`;
    const moodMessageEl = document.querySelector('#dashboardPage .dynamic-mood-message');
    moodMessageEl.textContent = {
        motivated: "😍 You're on fire today! Let's level up 🚀",
        bored: "😴 Feeling low? Let's start with something light 🌱",
        stressed: "😟 Take it easy, here's a calming TEDx talk for you 🌸",
        okay: "🙂 Ready for a productive session? Let's go! 💪"
    }[profile.mood] || "🙂 Ready for a productive session? Let's go! 💪";
    moodMessageEl.className = `dynamic-mood-message mood-${profile.mood || 'okay'}`;
    
    document.querySelector('#dashboardPage .strength-zone p').textContent = (profile.confident_subjects || []).join(', ') || 'Not Set';
    document.querySelector('#dashboardPage .weakness-zone p').textContent = (profile.challenging_subjects || []).join(', ') || 'Not Set';
    
    // ** FIX: Re-add the button listeners **
    document.getElementById('advancedChallengeBtn').onclick = dashboard_openAdvancedChallenge;
    document.getElementById('extraHelpBtn').onclick = dashboard_getExtraHelp;

    const userDetailsContent = document.getElementById('userDetailsContent');
    userDetailsContent.innerHTML = `
        <p><strong>Level:</strong> ${profile.education_level || 'N/A'}</p>
        <p><strong>Institution:</strong> ${profile.institution_name || 'N/A'}</p>
        <p><strong>Location:</strong> ${profile.city || ''}${profile.city && profile.state ? ', ' : ''}${profile.state || ''}</p>
    `;

    const suggestion = dashboard_moodSuggestions[profile.mood] || dashboard_moodSuggestions['okay'];
    const card = document.querySelector('#dashboardPage .mood-suggestion-card');
    card.innerHTML = `
        <span class="mood-emoji">${suggestion.emoji}</span>
        <h3>${suggestion.title}</h3>
        <p>${suggestion.subtitle}</p>
        <button class="suggestion-action" onclick="dashboard_handleMoodAction('${profile.mood || 'okay'}')">${suggestion.action}</button>
    `;
    
    document.getElementById('streakValue').textContent = profile.current_streak || 0;
    
    dashboard_renderTodoList();
    dashboard_updateXPDisplay();
}
        
const motivationModalOverlay = document.getElementById('motivationModalOverlay');
const motivationModalTitle = document.getElementById('motivationModalTitle');
const motivationModalContent = document.getElementById('motivationModalContent');

let motivation_timerInterval = null;
let motivation_timeLeft = 0;
let motivation_isTimerRunning = false;
let motivation_originalTitle = document.title;
        
function openModal(title, htmlContent) {
    motivationModalTitle.textContent = title;
    motivationModalContent.innerHTML = htmlContent;
    motivationModalOverlay.style.display = 'flex';
}

function closeModal() {
    motivation_resetTimer(0, null, true);
    motivationModalOverlay.style.display = 'none';
}

function motivation_openModal(type) {
    const feature = motivation_features[type];
    openModal(feature.title, feature.html);
    if (type === 'procrastination') {
        motivation_updateStreakDisplay();
    }
}

const motivation_features = {
    procrastination: {
        title: '🎯 Beat Procrastination',
        html: `
            <h4>Break It Down</h4>
            <p>Feeling overwhelmed? Enter a big task and we'll break it into smaller, manageable steps for you.</p>
            <textarea id="taskInput" placeholder="e.g., Write a 10-page research paper" style="width: 100%; min-height: 60px; margin-top: 10px; border-radius: 8px; padding: 10px; background: var(--glass-bg-dark); color: var(--text-primary-dark); border: 1px solid var(--glass-border-dark); resize: vertical;"></textarea>
            <div style="text-align:center; margin: 15px 0;">
                <button class="motivation-btn" onclick="motivation_breakItDown()">Break It Down ✨</button>
            </div>
            <div id="taskOutput" class="motivation-feature" style="padding-top:0;">
                </div>
            <div class="motivation-feature">
                <div class="streak-display" id="streakDisplay"></div>
            </div>
        `
    },
    creativity: {
        title: '💡 Boost Creativity',
        html: `
            <div class="prompt-display" id="promptDisplay">Click the button for a creative prompt!</div>
            <div style="text-align:center; margin: 15px 0;">
                <button class="motivation-btn" onclick="motivation_generatePrompt()">🎲 New Prompt</button>
            </div>
            <div class="motivation-feature">
                <h4>🔥 Daily Challenge</h4>
                <p>Write 3 crazy ideas in 2 minutes!</p>
                <div class="timer-display" id="challengeTimerDisplay">02:00</div>
                <div class="timer-controls" style="text-align:center;">
                    <button onclick="motivation_startTimer(2 * 60, 'challengeTimerDisplay')">Start Challenge</button>
                </div>
            </div>
        `
    },
    focus: {
        title: '🧘 Stay Focused',
        html: `
            <p>Start a deep focus session. We'll remind you to stay on track if you switch tabs.</p>
            <div class="timer-display" id="focusTimerDisplay">45:00</div>
            <div class="timer-controls" style="text-align:center;">
                <button onclick="motivation_startFocusTimer(45 * 60, 'focusTimerDisplay')">▶️ Start Session</button>
                <button onclick="motivation_pauseTimer()">⏸️ Pause</button>
                <button onclick="motivation_resetTimer(45 * 60, 'focusTimerDisplay')">⏹️ Stop Session</button>
            </div>
        `
    }
};

const motivation_prompts = [
    "Imagine your problem as a superhero. How would they solve it?",
    "What if colors had sounds? Describe the sound of blue.",
    "Combine a cloud and a key to create a new invention.",
    "Describe your day from the perspective of a housefly.",
    "What would you do with a door that leads to any time in the past?"
];

function motivation_breakItDown() {
    const taskInput = document.getElementById('taskInput');
    const taskOutput = document.getElementById('taskOutput');
    const task = taskInput.value.trim().toLowerCase();

    if (task === '') {
        taskOutput.innerHTML = "<p>Please enter a task to break down.</p>";
        return;
    }

    let steps = [];
    if (task.includes('write') || task.includes('essay') || task.includes('paper') || task.includes('report')) {
        steps = [ "Clearly define the topic and thesis statement.", "Gather research materials (articles, books).", "Create a detailed outline with main points.", "Write the first draft of the introduction.", "Draft the body paragraphs, one at a time.", "Write the conclusion.", "Review and edit for clarity and grammar." ];
    } else if (task.includes('clean') || task.includes('organize')) {
        steps = [ "Remove any obvious trash.", "Pick one small area to start with (e.g., a single shelf).", "Sort items into 'keep', 'donate', and 'discard' piles.", "Wipe down all surfaces in your area.", "Put the 'keep' items back neatly.", "Choose the next small area and repeat." ];
    } else if (task.includes('study') || task.includes('learn')) {
        steps = [ "Identify the specific topic or chapter.", "Spend 15 minutes reviewing your notes.", "Try to explain the main concept out loud.", "Do 3-5 practice problems or a review question.", "Take a 5-minute break.", "Create a small summary or flashcards." ];
    } else {
        steps = [ `Define what 'done' looks like for "${taskInput.value}".`, "List all materials or info you need.", "Identify the very first physical action to take.", "Set a 15-minute timer and work only on that first action.", "Plan the next small step." ];
    }

    let outputHtml = '<h4>Your Action Plan:</h4><ul style="list-style: none; padding-left: 0;">';
    steps.forEach(step => {
        outputHtml += `<li style="background: var(--glass-bg-dark); margin: 8px 0; padding: 12px; border-radius: 8px; display: flex; align-items: center;">
            <input type="checkbox" style="margin-right: 12px; width: 18px; height: 18px;" onclick="motivation_updateStreakOnCheck(event)"> <span>${step}</span>
        </li>`;
    });
    outputHtml += '</ul>';
    taskOutput.innerHTML = outputHtml;
}

function motivation_updateStreakOnCheck(event) {
    const list = event.target.closest('ul');
    if (!list.hasAttribute('data-credited')) {
        alert("Great job on starting your task! Streak updated. 🔥");
        motivation_updateStreak();
        list.setAttribute('data-credited', 'true');
    }
}
        
function motivation_updateTimerDisplay(displayId) {
    const minutes = Math.floor(motivation_timeLeft / 60);
    const seconds = motivation_timeLeft % 60;
    if(document.getElementById(displayId)){
        document.getElementById(displayId).textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

function motivation_startTimer(duration, displayId) {
    if (motivation_isTimerRunning) return;
    motivation_isTimerRunning = true;
    motivation_timeLeft = (motivation_timeLeft > 0) ? motivation_timeLeft : duration;
    motivation_updateTimerDisplay(displayId);

    motivation_timerInterval = setInterval(() => {
        motivation_timeLeft--;
        motivation_updateTimerDisplay(displayId);
        if (motivation_timeLeft <= 0) {
            clearInterval(motivation_timerInterval);
            motivation_isTimerRunning = false;
            alert("Time's up! Great work.");
            motivation_resetTimer(duration, displayId);
        }
    }, 1000);
}

function motivation_pauseTimer() {
    clearInterval(motivation_timerInterval);
    motivation_isTimerRunning = false;
}

function motivation_resetTimer(duration, displayId, forceStop = false) {
    clearInterval(motivation_timerInterval);
    motivation_isTimerRunning = false;
    motivation_timeLeft = duration;
    if(displayId) motivation_updateTimerDisplay(displayId);
    
    if (forceStop || displayId === 'focusTimerDisplay') {
        document.removeEventListener('visibilitychange', motivation_handleVisibilityChange);
        document.title = motivation_originalTitle;
    }
}

function motivation_updateStreak() {
    const today = new Date().toDateString();
    const streakData = JSON.parse(localStorage.getItem('procrastinationStreak')) || { count: 0, lastCompleted: '' };
    
    if (streakData.lastCompleted !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (streakData.lastCompleted === yesterday.toDateString()) {
                    streakData.count++;
            } else {
                    streakData.count = 1;
            }
            streakData.lastCompleted = today;
            localStorage.setItem('procrastinationStreak', JSON.stringify(streakData));
            motivation_updateStreakDisplay();
    }
}

function motivation_updateStreakDisplay() {
    const streakData = JSON.parse(localStorage.getItem('procrastinationStreak')) || { count: 0 };
    const streakDisplay = document.getElementById('streakDisplay');
    if (streakData && streakDisplay) {
        if (streakData.count > 0) {
            streakDisplay.innerHTML = `You’ve started a task <b>${streakData.count} day${streakData.count > 1 ? 's' : ''} in a row!</b> 🔥`;
        } else {
            streakDisplay.innerHTML = `Break down a task and check one item to start your streak!`;
        }
    }
}
        
function motivation_generatePrompt() {
    const randomIndex = Math.floor(Math.random() * motivation_prompts.length);
    document.getElementById('promptDisplay').textContent = motivation_prompts[randomIndex];
}
        
function motivation_startFocusTimer(duration, displayId) {
    document.addEventListener('visibilitychange', motivation_handleVisibilityChange);
    motivation_startTimer(duration, displayId);
}

function motivation_handleVisibilityChange() {
    if (!motivation_isTimerRunning) return;
    if (document.hidden) {
        document.title = "👀 Stay on track...";
    } else {
        document.title = motivation_originalTitle;
        alert("Welcome back! Let's keep focusing.");
    }
}
        
const dashboard_moodSuggestions = {
    motivated: { emoji: '😍', title: "Challenge Unlocked!", subtitle: "You're on fire! Let's use that energy.", action: "Speed-learn something new 🚀"},
    okay: { emoji: '🙂', title: "Ready to Go?", subtitle: "A quick warm-up can make all the difference.", action: "Take a quick quiz to warm up 📝" },
    bored: { emoji: '😴', title: "Feeling a Bit Slow?", subtitle: "Let's kickstart your brain with a fun challenge.", action: "Try a 5-min puzzle/game 🎮" },
    stressed: { emoji: '😟', title: "Feeling Overwhelmed?", subtitle: "It's okay to pause. Take a moment for yourself.", action: "Here’s a mindfulness video 🧘" }
};
        
let puzzle_secretNumber = 0;
let speedLearn_startTime = 0;
const quiz_questions = [
    { q: "What is the capital of Japan?", o: ["Beijing", "Seoul", "Tokyo", "Bangkok"], a: 2 },
    { q: "Which planet is known as the Red Planet?", o: ["Earth", "Mars", "Jupiter", "Venus"], a: 1 },
    { q: "Who wrote 'Romeo and Juliet'?", o: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], a: 1 }
];

function dashboard_createPuzzleGame() {
    puzzle_secretNumber = Math.floor(Math.random() * 50) + 1;
    return `
        <p>I'm thinking of a number between 1 and 50. Can you guess it?</p>
        <input type="number" id="puzzleGuess" placeholder="Enter your guess" style="width:100%; padding:10px; margin: 15px 0; border-radius:8px; background:var(--glass-bg-dark); color:var(--text-primary-dark); border:1px solid var(--glass-border-dark);">
        <div style="text-align:center;"><button class="motivation-btn" onclick="puzzle_checkGuess()">Submit Guess</button></div>
        <p id="puzzleFeedback" style="text-align:center; margin-top:15px; font-weight:bold;"></p>
    `;
}

function puzzle_checkGuess() {
    const guess = parseInt(document.getElementById('puzzleGuess').value);
    const feedback = document.getElementById('puzzleFeedback');
    if (isNaN(guess)) {
        feedback.textContent = "Please enter a valid number."; return;
    }
    if (guess === puzzle_secretNumber) {
        feedback.textContent = `🎉 Correct! The number was ${puzzle_secretNumber}. Great job!`;
        feedback.style.color = 'var(--success)';
    } else if (guess < puzzle_secretNumber) {
        feedback.textContent = "Too low! Try a higher number. 🤔";
        feedback.style.color = 'var(--secondary-color-dark)';
    } else {
        feedback.textContent = "Too high! Try a lower number. 🤔";
        feedback.style.color = 'var(--secondary-color-dark)';
    }
}

function dashboard_createMindfulnessVideo() {
    return `
        <p>Take a few deep breaths and watch this short video to reset your mind.</p>
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin-top:15px; border-radius:12px;">
            <iframe src="https://www.youtube.com/embed/inpok4MKVLM" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
        </div>
    `;
}

function dashboard_createQuickQuiz() {
    let quizHtml = '<div id="quizForm">';
    quiz_questions.forEach((item, index) => {
        quizHtml += `<div style="margin-bottom:15px;"><h4>${index + 1}. ${item.q}</h4>`;
        item.o.forEach((option, optIndex) => {
            quizHtml += `<label style="display:block; margin:5px 0;"><input type="radio" name="q${index}" value="${optIndex}"> ${option}</label>`;
        });
        quizHtml += `</div>`;
    });
    quizHtml += `</div><div style="text-align:center; margin-top:20px;"><button class="motivation-btn" onclick="quiz_submit()">Submit Answers</button></div>
    <p id="quizResult" style="text-align:center; margin-top:15px; font-weight:bold;"></p>`;
    return quizHtml;
}

function quiz_submit() {
    let score = 0;
    quiz_questions.forEach((item, index) => {
        const selected = document.querySelector(`input[name="q${index}"]:checked`);
        if (selected && parseInt(selected.value) === item.a) {
            score++;
        }
    });
    const resultEl = document.getElementById('quizResult');
    resultEl.textContent = `You scored ${score} out of ${quiz_questions.length}! ${score > 1 ? 'Well done! 👍' : 'Good start! 👍'}`;
}
        
function dashboard_createSpeedLearnChallenge() {
    speedLearn_startTime = 0;
    const text = "The synthesis of learning and technology offers unprecedented opportunities. Personalized educational pathways can adapt in real-time to a student's cognitive state, optimizing for both retention and engagement. This revolutionizes traditional pedagogy.";
    return `
        <p>How fast can you type this paragraph? The timer starts when you begin typing.</p>
        <div style="background:var(--glass-bg-dark); padding:15px; border-radius:10px; margin: 15px 0; font-style:italic;">${text}</div>
        <textarea id="speedLearnInput" oninput="speedLearn_start(event)" placeholder="Start typing here..." style="width: 100%; min-height: 80px; border-radius: 8px; padding: 10px; background: var(--glass-bg-dark); color: var(--text-primary-dark); border: 1px solid var(--glass-border-dark); resize: vertical;"></textarea>
        <p id="speedLearnResult" style="text-align:center; margin-top:15px; font-weight:bold;"></p>
    `;
}

function speedLearn_start(event) {
    if (speedLearn_startTime === 0) {
        speedLearn_startTime = new Date().getTime();
    }
    const typedText = event.target.value;
    const originalText = "The synthesis of learning and technology offers unprecedented opportunities. Personalized educational pathways can adapt in real-time to a student's cognitive state, optimizing for both retention and engagement. This revolutionizes traditional pedagogy.";
    if(typedText.length >= originalText.length) {
        const endTime = new Date().getTime();
        const timeTaken = (endTime - speedLearn_startTime) / 1000 / 60; // in minutes
        const wordCount = originalText.split(' ').length;
        const wpm = Math.round(wordCount / timeTaken);
        document.getElementById('speedLearnResult').textContent = `🚀 Challenge Complete! Your speed is approximately ${wpm} WPM!`;
        speedLearn_startTime = 0; // Reset for next time
    }
}
        
function dashboard_handleMoodAction(mood) {
    let title = '';
    let content = '';

    switch (mood) {
        case 'bored':
            title = '🎮 5-Minute Puzzle';
            content = dashboard_createPuzzleGame();
            break;
        case 'stressed':
            title = '🧘 Mindfulness Moment';
            content = dashboard_createMindfulnessVideo();
            break;
        case 'okay':
            title = '📝 Quick Brain Warm-Up';
            content = dashboard_createQuickQuiz();
            break;
        case 'motivated':
            title = '🚀 Speed-Learn Challenge';
            content = dashboard_createSpeedLearnChallenge();
            break;
        default:
            title = '📝 Quick Brain Warm-Up';
            content = dashboard_createQuickQuiz();
    }
    openModal(title, content);
}

// ** FIX: Re-added the missing functions **
function dashboard_openAdvancedChallenge() {
    const confidentSubjects = appState.onboardingProfile.confident_subjects;
    if (!confidentSubjects || confidentSubjects.length === 0) {
        alert("Please select a confident subject in your preferences first!");
        return;
    }
    const subject = confidentSubjects[0];
    const query = encodeURIComponent(`${subject} advanced concepts research paper`);
    const url = `https://scholar.google.com/scholar?q=${query}`;
    window.open(url, '_blank');
}

function dashboard_getExtraHelp() {
    const challengingSubjects = appState.onboardingProfile.challenging_subjects;
    if (!challengingSubjects || challengingSubjects.length === 0) {
        alert("Please select a challenging subject in your preferences first!");
        return;
    }
    const subject = challengingSubjects[0];
    const query = encodeURIComponent(`how to improve in ${subject} for students study tips`);
    const url = `https://www.google.com/search?q=${query}`;
    window.open(url, '_blank');
}
        
function dashboard_updateXPDisplay() {
    const xpValue = parseInt(localStorage.getItem('userXP')) || 0;
    document.getElementById('xpValue').textContent = xpValue.toLocaleString();
}
        
const todoListContainer = document.getElementById('todoListContainer');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoInput = document.getElementById('todoInput');

function dashboard_renderTodoList() {
    const tasks = JSON.parse(localStorage.getItem('studyPlanTasks')) || [];
    todoListContainer.innerHTML = '';
    
    // In this version, we only show incomplete tasks since completed ones are deleted
    tasks.forEach((task, index) => {
        if (!task.completed) {
            const item = document.createElement('div');
            item.className = 'study-plan-item';
            item.innerHTML = `
                <div class="task-checkbox" onclick="dashboard_toggleTask(${index})"></div>
                <div><h4>${task.text}</h4></div>
            `;
            todoListContainer.appendChild(item);
        }
    });
    dashboard_updateProgress();
}

function dashboard_addTask() {
    const taskText = todoInput.value.trim();
    if (taskText === '') return;
    
    const tasks = JSON.parse(localStorage.getItem('studyPlanTasks')) || [];
    tasks.push({ text: taskText, completed: false });
    localStorage.setItem('studyPlanTasks', JSON.stringify(tasks));
    
    todoInput.value = '';
    dashboard_renderTodoList();
}

addTodoBtn.addEventListener('click', dashboard_addTask);
todoInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        dashboard_addTask();
    }
});

// ** FIX: Updated task completion and deletion logic **
function dashboard_toggleTask(originalIndex) {
    let tasks = JSON.parse(localStorage.getItem('studyPlanTasks')) || [];
    
    // Find the actual index of the item to be deleted from the visible list
    let incompleteTaskIndex = -1;
    let count = -1;
    for(let i=0; i<tasks.length; i++) {
        if(!tasks[i].completed) {
            count++;
            if(count === originalIndex) {
                incompleteTaskIndex = i;
                break;
            }
        }
    }

    if (incompleteTaskIndex !== -1) {
        // Award XP once
        let currentXP = parseInt(localStorage.getItem('userXP')) || 0;
        currentXP += 10;
        localStorage.setItem('userXP', currentXP);
        dashboard_updateXPDisplay();

        // Mark as completed instead of deleting immediately to handle indexes correctly.
        // Or better, we filter out the completed task and save the new array
        let incompleteTasks = tasks.filter(t => !t.completed);
        incompleteTasks.splice(originalIndex, 1); // remove from the visible list
        
        let completedTasks = tasks.filter(t => t.completed);

        // Rebuild the main tasks array
        localStorage.setItem('studyPlanTasks', JSON.stringify([...incompleteTasks, ...completedTasks]));
        
        // Find the task and delete it from the original array
        tasks.splice(incompleteTaskIndex, 1);
        localStorage.setItem('studyPlanTasks', JSON.stringify(tasks));

        dashboard_renderTodoList();
    }
}

function dashboard_updateProgress() {
    const tasks = JSON.parse(localStorage.getItem('studyPlanTasks')) || [];
    const completed = tasks.filter(task => task.completed).length; // This will be 0 now
    const total = tasks.length;
    const progressFill = document.getElementById('todoProgressFill');
    const progressText = document.getElementById('todoProgressText');
    
    // We base progress on the original list before deletion if needed, but for simplicity
    // we'll just show remaining tasks.
    if (total === 0) {
        progressFill.style.width = '100%';
        progressText.innerHTML = 'All tasks completed for today! 🎉';
    } else {
        // This logic is tricky now. A better approach might be to store total tasks separately.
        // For now, let's keep it simple.
        progressFill.style.width = '0%';
        progressText.innerHTML = `${total} task${total > 1 ? 's' : ''} remaining.`;
    }
}
        
document.addEventListener('DOMContentLoaded', () => {
    showPage('loginSignupPage');

    const splashColors = ['#f57c00', '#ffa726', '#ffd54f', '#f5f5f5', '#90caf9'];
    document.addEventListener('mousemove', function (e) {
        const splash = document.createElement('div');
        splash.className = 'cursor-splash';
        
        const randomColor = splashColors[Math.floor(Math.random() * splashColors.length)];
        splash.style.backgroundColor = randomColor;

        splash.style.left = `${e.clientX}px`;
        splash.style.top = `${e.clientY}px`;

        document.body.appendChild(splash);

        setTimeout(() => {
            splash.remove();
        }, 600);
    });
});

