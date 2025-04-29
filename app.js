document.addEventListener('DOMContentLoaded', () => {
    const authContainer = document.getElementById('auth-container');
    const mainContainer = document.getElementById('main-container');
    const authForm = document.getElementById('auth-form');
    const authButton = document.getElementById('auth-button');
    const authSwitch = document.getElementById('auth-switch');
    let isLogin = true;
    let chart;
  
    // Toggle login/register
    authSwitch.addEventListener('click', e => {
      e.preventDefault();
      isLogin = !isLogin;
      authButton.textContent = isLogin ? 'Login' : 'Register';
      authSwitch.textContent = isLogin ? 'Register' : 'Login';
    });
  
    // Authentication
    authForm.addEventListener('submit', e => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const action = isLogin ? auth.signInWithEmailAndPassword : auth.createUserWithEmailAndPassword;
      action(email, password)
        .then(() => {
          authContainer.classList.add('hidden');
          mainContainer.classList.remove('hidden');
          loadPlanner();
        })
        .catch(err => alert(err.message));
    });
  
    // Logout
    document.getElementById('logout').addEventListener('click', () => {
      auth.signOut().then(() => {
        mainContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
      });
    });
  
    // Navigation
    document.querySelectorAll('nav button[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        document.querySelectorAll('.view').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(view).classList.remove('hidden');
        if (view === 'planner') loadPlanner();
        if (view === 'tracker') loadTracker();
        if (view === 'analytics') loadAnalytics();
      });
    });
  
    // CSV import and scheduling
    document.getElementById('csv-input').addEventListener('change', e => {
      const file = e.target.files[0];
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: results => {
          const tasks = results.data;
          const batch = db.batch();
          tasks.forEach(row => {
            const due = new Date(row.DueDate);
            const ref = db.collection('tasks').doc();
            batch.set(ref, {
              userId: auth.currentUser.uid,
              course: row.Course,
              title: row.Task,
              dueDate: firebase.firestore.Timestamp.fromDate(due),
              duration: parseInt(row.Duration, 10),
              isCompleted: false
            });
          });
          batch.commit().then(() => loadPlanner());
        }
      });
    });
  
    // Load planner tasks
    function loadPlanner() {
      db.collection('tasks')
        .where('userId', '==', auth.currentUser.uid)
        .orderBy('dueDate')
        .get()
        .then(snapshot => {
          const list = document.getElementById('task-list');
          list.innerHTML = '';
          snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = data.isCompleted;
            checkbox.addEventListener('change', () => {
              doc.ref.update({ isCompleted: checkbox.checked });
            });
            label.textContent = `${data.course}: ${data.title} (Due ${data.dueDate.toDate().toLocaleDateString()}, ${data.duration} min)`;
            label.prepend(checkbox);
            list.appendChild(li).appendChild(label);
          });
        });
    }
  
    // Load today's tasks
    function loadTracker() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
  
      db.collection('tasks')
        .where('userId', '==', auth.currentUser.uid)
        .where('dueDate', '>=', firebase.firestore.Timestamp.fromDate(today))
        .where('dueDate', '<', firebase.firestore.Timestamp.fromDate(tomorrow))
        .orderBy('dueDate')
        .get()
        .then(snapshot => {
          const list = document.getElementById('today-tasks');
          list.innerHTML = '';
          snapshot.forEach(doc => {
            const data = doc.data();
            const li = document.createElement('li');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = data.isCompleted;
            checkbox.addEventListener('change', () => {
              doc.ref.update({ isCompleted: checkbox.checked });
            });
            li.textContent = `${data.title} (${data.course})`;
            li.prepend(checkbox);
            list.appendChild(li);
          });
        });
    }
  
    // Load analytics chart
    function loadAnalytics() {
      db.collection('tasks')
        .where('userId', '==', auth.currentUser.uid)
        .get()
        .then(snapshot => {
          const byCourse = {};
          snapshot.forEach(doc => {
            const { course, duration } = doc.data();
            byCourse[course] = (byCourse[course] || 0) + duration;
          });
          const labels = Object.keys(byCourse);
          const data = labels.map(c => byCourse[c]);
  
          const ctx = document.getElementById('time-chart').getContext('2d');
          if (chart) chart.destroy();
          chart = new Chart(ctx, {
            type: 'pie',
            data: {
              labels,
              datasets: [{ data }]
            },
            options: { responsive: true }
          });
        });
    }
  });
  