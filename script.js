// Importações do Firebase SDK
// O 'import' serve para trazer as funcionalidades do Firebase que usaremos no app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Substitua esta configuração pelas informações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "INSIRA_SUA_APIKEY_AQUI",
  authDomain: "INSIRA_SEU_AUTHDOMAIN_AQUI",
  projectId: "INSIRA_SEU_PROJECTID_AQUI",
  storageBucket: "INSIRA_SEU_STORAGEBUCKET_AQUI",
  messagingSenderId: "INSIRA_SEU_MESSAGINGSENDERID_AQUI",
  appId: "INSIRA_SEU_APPID_AQUI"
};

// Variáveis globais de configuração
const appId = firebaseConfig.appId;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Elementos do DOM (Document Object Model)
// Aqui, selecionamos os elementos do nosso HTML para poder manipulá-los no JavaScript.
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

// Variáveis de estado do aplicativo
let db, auth; // Variáveis para as instâncias do Firestore e Authentication.
let userId = null; // ID do usuário logado.
const SECRET_PASSWORD = "secretaria123"; // Senha fixa para o login.

// --- Funções da Interface do Usuário (UI) ---
// Função para exibir um modal de mensagem na tela.
const showMessageModal = (message) => {
    modalText.textContent = message;
    modalMessage.classList.remove('hidden');
    modalMessage.classList.add('flex');
};

// Função para esconder o modal de mensagem.
const hideMessageModal = () => {
    modalMessage.classList.add('hidden');
    modalMessage.classList.remove('flex');
};

// Função para exibir a seção de login.
const showLogin = () => {
    loginSection.classList.remove('hidden', 'opacity-0');
    loginSection.classList.add('opacity-100');
    mainApp.classList.add('hidden', 'opacity-0');
};

// Função para exibir a seção principal do aplicativo.
const showMainApp = () => {
    loginSection.classList.add('hidden', 'opacity-0');
    mainApp.classList.remove('hidden', 'opacity-0');
    mainApp.classList.add('opacity-100');
};

// Função de utilidade para formatar o número de telefone para o WhatsApp.
const formatPhoneNumber = (phone) => {
    // Remove tudo que não é número e adiciona o prefixo internacional se necessário (ex: 55 para o Brasil).
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone; // Assume Brasil
    }
    return cleanPhone;
};

// --- Autenticação e Inicialização do Firebase ---
const initializeFirebase = async () => {
    try {
        // Verifica se a configuração do Firebase é válida.
        if (!firebaseConfig.projectId) {
            console.error("Erro: projectId do Firebase não fornecido. Verifique as variáveis de ambiente.");
            showMessageModal("Erro de configuração: ID do projeto do Firebase ausente.");
            return;
        }

        // Inicializa o app do Firebase com as configurações fornecidas.
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        setLogLevel('debug');
        console.log("Firebase inicializado.");

        // O 'onAuthStateChanged' é um "ouvinte" que detecta o estado de autenticação do usuário.
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Se o usuário está logado, armazena o ID e exibe a tela principal.
                userId = user.uid;
                console.log("Usuário autenticado:", userId);
                userInfoSpan.textContent = `Logado como ${userId.substring(0, 8)}...`;
                appIdSpan.textContent = appId;
                showMainApp();
                setupRealtimeClientsListener(userId);
            } else {
                // Se não há usuário logado, exibe a tela de login.
                console.log("Nenhum usuário logado.");
                userId = null;
                showLogin();
            }
        });

        // Tenta fazer o login com o token inicial ou anonimamente, se o token não existir.
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
    }
};

// --- Event Listeners ---
// Ouve o clique no botão de login.
loginBtn.addEventListener('click', () => {
    if (passwordInput.value === SECRET_PASSWORD) {
        console.log("Senha correta. Acesso concedido.");
    } else {
        showMessageModal('Senha incorreta!');
    }
});

// Ouve o clique no botão de fechar do modal de mensagem.
modalCloseBtn.addEventListener('click', hideMessageModal);

// Ouve o clique no botão de logout.
logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await signOut(auth);
        console.log("Usuário desconectado.");
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
});

// Ouve o envio do formulário para adicionar um novo cliente.
addClientForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!userId) {
        console.error("Usuário não autenticado para adicionar cliente.");
        return;
    }

    const name = clientNameInput.value;
    const birthday = clientBirthdayInput.value;
    const phone = clientPhoneInput.value;

    try {
        // Adiciona um novo documento (cliente) à coleção 'clientes' no Firestore.
        const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/clientes`), {
            name: name,
            birthday: birthday,
            phone: phone,
            active: true, // Adiciona o status 'active' para indicar que o cliente está ativo.
            createdAt: new Date()
        });
        console.log("Cliente adicionado com ID:", docRef.id);
        addClientForm.reset();
        showMessageModal("Cliente adicionado com sucesso!");
    } catch (error) {
        console.error("Erro ao adicionar cliente:", error);
        showMessageModal("Erro ao adicionar cliente. Tente novamente.");
    }
});

// --- Funções de manipulação de clientes ---
// Função para desabilitar um cliente.
const disableClient = async (clientId) => {
    if (!userId) {
        showMessageModal("Erro: Usuário não autenticado.");
        return;
    }
    // Cria uma referência para o documento do cliente e atualiza o campo 'active' para 'false'.
    const clientRef = doc(db, `artifacts/${appId}/users/${userId}/clientes`, clientId);
    try {
        await updateDoc(clientRef, { active: false });
        showMessageModal("Cliente desabilitado com sucesso!");
        console.log("Cliente desabilitado:", clientId);
    } catch (error) {
        console.error("Erro ao desabilitar cliente:", error);
        showMessageModal("Erro ao desabilitar cliente. Tente novamente.");
    }
};

// --- Funções para manipulação de mensagens e WhatsApp ---
// Gera uma mensagem de aniversário aleatória e positiva.
const getBirthdayMessage = (clientName) => {
    const messages = [
        `Olá, ${clientName}! A Dra. da sua psicóloga deseja um feliz e inspirador aniversário! Que seu novo ciclo seja repleto de autoconhecimento e crescimento. Conte com ela para essa jornada. 🎂`,
        `Parabéns, ${clientName}! A Dra. e a sua equipe te desejam um dia maravilhoso, cheio de luz e comemoração. Que este novo ano te fortaleça ainda mais. ✨`,
        `Feliz aniversário, ${clientName}! A jornada da vida é única e a sua tem sido admirável. A Dra. te envia os melhores votos e está à disposição para te acompanhar. 🎈`,
        `Que seu dia seja tão incrível quanto você, ${clientName}! A Dra. te deseja um feliz aniversário e um novo ano de vida com muita paz e realizações. 😊`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
};

// Copia a mensagem para a área de transferência e abre o WhatsApp com a mensagem pré-preenchida.
window.copyToClipboardAndOpenWhatsApp = (phone, clientName) => {
    const message = getBirthdayMessage(clientName);
    const whatsappUrl = `https://wa.me/${formatPhoneNumber(phone)}?text=${encodeURIComponent(message)}`;
    
    // Abre a URL do WhatsApp em uma nova aba.
    window.open(whatsappUrl, '_blank');

    // Copia a mensagem para a área de transferência para que a secretária possa usar também.
    try {
        navigator.clipboard.writeText(message).then(() => {
            showMessageModal("Mensagem copiada para a área de transferência!");
        }).catch(err => {
            console.error('Erro ao copiar a mensagem:', err);
            // Fallback para ambientes restritos (como iframes).
            const textArea = document.createElement("textarea");
            textArea.value = message;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        });
    } catch (err) {
        console.error('Erro ao usar a API Clipboard:', err);
    }
};

// --- Funções de Renderização e Sincronização em Tempo Real ---
// Configura um "ouvinte" em tempo real para a coleção de clientes.
const setupRealtimeClientsListener = (uid) => {
    const q = query(collection(db, `artifacts/${appId}/users/${uid}/clientes`));
    // 'onSnapshot' é a função que mantém a lista de clientes atualizada automaticamente.
    onSnapshot(q, (snapshot) => {
        const clients = [];
        snapshot.forEach((doc) => {
            clients.push({ id: doc.id, ...doc.data() });
        });
        renderClients(clients.filter(c => c.active !== false)); // Filtra apenas clientes ativos.
        renderTodayBirthdays(clients.filter(c => c.active !== false));
    }, (error) => {
        console.error("Erro no listener de clientes:", error);
    });
};

// Renderiza a lista de todos os clientes na tela.
const renderClients = (clients) => {
    if (clients.length === 0) {
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

// Renderiza a lista de aniversariantes do dia.
const renderTodayBirthdays = (clients) => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    // Filtra os clientes que fazem aniversário hoje.
    const birthdays = clients.filter(client => {
        const [year, month, day] = client.birthday.split('-').map(Number);
        return month === todayMonth && day === todayDay;
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

// Inicia a aplicação. Esta é a primeira função que é chamada quando a página carrega.
initializeFirebase();
