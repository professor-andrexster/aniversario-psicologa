// script.js - versão proposta (substitua seu script.js por este)
// Importações do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// CONFIG - copie sua configuração (use projectId preferencialmente)
const firebaseConfig = {
  apiKey: "AIzaSyCaKrCOyQ5rZs6Z6U73Yf-q1qQaYsQzc3A",
  authDomain: "app-aniversario-c08f4.firebaseapp.com",
  projectId: "app-aniversario-c08f4",
  storageBucket: "app-aniversario-c08f4.firebasestorage.app",
  messagingSenderId: "1031975722114",
  appId: "1:1031975722114:web:19ec4e44c2965b6474689b",
  measurementId: "G-2MZ8JNXJXR"
};

// Elementos DOM
const loginSection = document.getElementById('login-section');
const mainApp = document.getElementById('main-app');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfoSpan = document.getElementById('user-info');
const appIdSpan = document.getElementById('app-id');
const addClientForm = document.getElementById('add-client-form');
const clientNameInput = document.getElementById('client-name');
const clientBirthdayInput = document.getElementById('client-birthday');
const clientPhoneInput = document.getElementById('client-phone');
const clientListDiv = document.getElementById('client-list');
const todayBirthdaysList = document.getElementById('today-birthdays-list');
const birthdaysTodaySection = document.getElementById('birthdays-today');

const modalMessage = document.getElementById('modal-message');
const modalText = document.getElementById('modal-text');
const modalCloseBtn = document.getElementById('modal-close-btn');

let db, auth;
let userId = null;
const SECRET_PASSWORD = "secretaria123";

// Helper UI
const showMessageModal = (message) => {
    modalText.textContent = message;
    modalMessage.classList.remove('hidden');
    modalMessage.classList.add('flex');
};
const hideMessageModal = () => {
    modalMessage.classList.add('hidden');
    modalMessage.classList.remove('flex');
};
modalCloseBtn.addEventListener('click', hideMessageModal);

const showLogin = () => {
    loginSection.classList.remove('hidden', 'opacity-0');
    loginSection.classList.add('opacity-100');
    mainApp.classList.add('hidden', 'opacity-0');
};
const showMainApp = () => {
    loginSection.classList.add('hidden', 'opacity-0');
    mainApp.classList.remove('hidden', 'opacity-0');
    mainApp.classList.add('opacity-100');
};

const formatPhoneNumber = (phone) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;
    return cleanPhone;
};

const getBirthdayMessage = (clientName) => {
    const messages = [
        `Olá, ${clientName}! A Dra. da sua psicóloga deseja um feliz e inspirador aniversário! Que seu novo ciclo seja repleto de autoconhecimento e crescimento. Conte com ela para essa jornada. 🎂`,
        `Parabéns, ${clientName}! A Dra. e a sua equipe te desejam um dia maravilhoso, cheio de luz e comemoração. Que este novo ano te fortaleça ainda mais. ✨`,
        `Feliz aniversário, ${clientName}! A jornada da vida é única e a sua tem sido admirável. A Dra. te envia os melhores votos e está à disposição para te acompanhar. 🎈`,
        `Que seu dia seja tão incrível quanto você, ${clientName}! A Dra. te deseja um feliz aniversário e um novo ano de vida com muita paz e realizações. 😊`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
};

window.copyToClipboardAndOpenWhatsApp = (phone, clientName) => {
    const message = getBirthdayMessage(clientName);
    const whatsappUrl = `https://wa.me/${formatPhoneNumber(phone)}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    try {
        navigator.clipboard.writeText(message).then(() => showMessageModal("Mensagem copiada para a área de transferência!"));
    } catch (err) {
        console.error('Clipboard fallback', err);
    }
};

// Normalize appId: use projectId (mais seguro)
const appIdSafe = firebaseConfig.projectId || firebaseConfig.appId || 'app';

// Inicializa Firebase
const initializeFirebase = async () => {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Firebase inicializado:", firebaseConfig.projectId);
        // Observador de estado de auth
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("Auth detectado, uid:", userId);
                userInfoSpan.textContent = `Logado como ${userId.substring(0,8)}...`;
                appIdSpan.textContent = appIdSafe;
                // Aqui só abrimos o app se o usuário tiver passado pela senha local
                const isAuthorized = localStorage.getItem('authorized') === 'true';
                if (isAuthorized) {
                    showMainApp();
                    setupRealtimeClientsListener(userId);
                } else {
                    // força que o usuário entre com a senha mesmo que já haja sessão anon.
                    showLogin();
                }
            } else {
                userId = null;
                showLogin();
            }
        });
    } catch (error) {
        console.error("Erro init Firebase:", error);
        showMessageModal("Erro ao inicializar Firebase (ver console).");
    }
};

// Login (senha local + signInAnonymously se necessário)
loginBtn.addEventListener('click', async () => {
    const pass = passwordInput.value;
    if (pass === SECRET_PASSWORD) {
        try {
            // marque usuário como autorizado localmente
            localStorage.setItem('authorized', 'true');
            // faça login anon (se ainda não logado)
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }
            showMainApp();
            if (auth.currentUser) {
                setupRealtimeClientsListener(auth.currentUser.uid);
            }
            showMessageModal("Acesso liberado.");
        } catch (err) {
            console.error("Erro ao autenticar anonimamente:", err);
            showMessageModal("Erro ao autenticar. Verifique o console.");
        }
    } else {
        showMessageModal("Senha incorreta!");
    }
});

// Logout
logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        localStorage.removeItem('authorized');
        await signOut(auth);
        userId = null;
        showLogin();
    } catch (err) {
        console.error("Erro logout", err);
    }
});

// Adicionar cliente (com construção segura do path)
addClientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!auth || !auth.currentUser) {
        showMessageModal("Usuário não autenticado. Faça login.");
        return;
    }
    const uid = auth.currentUser.uid;
    const name = clientNameInput.value.trim();
    const birthday = clientBirthdayInput.value;
    const phone = clientPhoneInput.value.trim();

    if (!name || !birthday || !phone) {
        showMessageModal("Preencha todos os campos.");
        return;
    }

    try {
        // Construir referência: artifacts/{appIdSafe}/users/{uid}/clientes
        const artifactsCol = collection(db, 'artifacts');
        const appDocRef = doc(artifactsCol, appIdSafe);
        const usersColRef = collection(appDocRef, 'users');
        const userDocRef = doc(usersColRef, uid);
        const clientsColRef = collection(userDocRef, 'clientes');

        const docRef = await addDoc(clientsColRef, {
            name,
            birthday,
            phone,
            active: true,
            createdAt: new Date()
        });
        console.log("Cliente adicionado com ID:", docRef.id);
        addClientForm.reset();
        showMessageModal("Cliente adicionado com sucesso!");
    } catch (err) {
        console.error("Erro ao adicionar cliente:", err);
        // Mostre mensagem de erro com o código se houver
        showMessageModal("Erro ao adicionar cliente. Veja console (F12) para detalhes.");
    }
});

// Listener Realtime
const setupRealtimeClientsListener = (uid) => {
    try {
        const artifactsCol = collection(db, 'artifacts');
        const appDocRef = doc(artifactsCol, appIdSafe);
        const usersColRef = collection(appDocRef, 'users');
        const userDocRef = doc(usersColRef, uid);
        const clientsColRef = collection(userDocRef, 'clientes');

        const q = query(clientsColRef);
        onSnapshot(q, (snapshot) => {
            const clients = [];
            snapshot.forEach((d) => clients.push({ id: d.id, ...d.data() }));
            renderClients(clients.filter(c => c.active !== false));
            renderTodayBirthdays(clients.filter(c => c.active !== false));
        }, (error) => {
            console.error("Erro listener clientes:", error);
            showMessageModal("Erro ao sincronizar clientes (ver console).");
        });
    } catch (err) {
        console.error("Erro setup listener:", err);
    }
};

const disableClient = async (clientId) => {
    if (!auth || !auth.currentUser) {
        showMessageModal("Usuário não autenticado.");
        return;
    }
    const uid = auth.currentUser.uid;
    try {
        const artifactsCol = collection(db, 'artifacts');
        const appDocRef = doc(artifactsCol, appIdSafe);
        const usersColRef = collection(appDocRef, 'users');
        const userDocRef = doc(usersColRef, uid);
        const clientDocRef = doc(userDocRef, 'clientes', clientId); // doc(path) aceita 3+ args? Se ocorrer, use doc(db, `artifacts/${appIdSafe}/users/${uid}/clientes/${clientId}`)
        await updateDoc(clientDocRef, { active: false });
        showMessageModal("Cliente desabilitado!");
    } catch (err) {
        console.error("Erro desabilitar cliente:", err);
        showMessageModal("Erro ao desabilitar (ver console).");
    }
};

// Render functions (mantive seu layout)
const renderClients = (clients) => {
    if (!clients || clients.length === 0) {
        clientListDiv.innerHTML = '<div class="text-center text-gray-500">Nenhum cliente cadastrado.</div>';
        return;
    }
    clientListDiv.innerHTML = clients.map(client => `
        <div class="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            <div>
                <div class="font-bold text-lg text-gray-800">${client.name}</div>
                <div class="text-sm text-gray-500">Aniversário: ${client.birthday}</div>
                <div class="text-sm text-gray-500">Telefone: ${client.phone}</div>
            </div>
            <div class="flex items-center space-x-2">
                <button class="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors duration-300" onclick="disableClient('${client.id}')">Desabilitar</button>
            </div>
        </div>
    `).join('');
};

const renderTodayBirthdays = (clients) => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const birthdays = clients.filter(c => {
        try {
            const [y, m, d] = c.birthday.split('-').map(Number);
            return m === month && d === day;
        } catch {
            return false;
        }
    });
    if (birthdays.length > 0) {
        birthdaysTodaySection.classList.remove('hidden');
        todayBirthdaysList.innerHTML = birthdays.map(client => `
            <div class="bg-yellow-100 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-lg flex items-center justify-between" role="alert">
                <p class="font-bold">${client.name}</p>
                <button class="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors duration-300" onclick="copyToClipboardAndOpenWhatsApp('${client.phone}', '${client.name}')">Enviar Mensagem</button>
            </div>
        `).join('');
    } else {
        birthdaysTodaySection.classList.add('hidden');
    }
};

// Inicia
initializeFirebase();
