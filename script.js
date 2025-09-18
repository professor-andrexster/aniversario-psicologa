// Importações do Firebase SDK
// O 'import' serve para trazer as funcionalidades do Firebase que usaremos no app.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Substitua esta configuração pelas informações do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCaKrCOyQ5rZs6Z6U73Yf-q1qQaYsQzc3A",
  authDomain: "app-aniversario-c08f4.firebaseapp.com",
  projectId: "app-aniversario-c08f4",
  storageBucket: "app-aniversario-c08f4.firebasestorage.app",
  messagingSenderId: "1031975722114",
  appId: "1:1031975722114:web:19ec4e44c2965b6474689b",
  measurementId: "G-2MZ8JNXJXR"
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
            // O login anônimo será feito apenas na primeira vez, se o ambiente não tiver um token inicial.
            // Para login com senha, a autenticação anônima é chamada pelo botão de login.
        }
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
    }
};

// --- Event Listeners ---
// Ouve o clique no botão de login.
loginBtn.addEventListener('click', async () => {
    if (passwordInput.value === SECRET_PASSWORD) {
        console.log("Senha correta. Acesso concedido.");
        // A autenticação anônima é chamada apenas aqui, após a validação da senha.
        await signInAnonymously(auth);
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
        `Olá, ${clientName}! A Dra. Maria do Socorro deseja um feliz e inspirador aniversário! Que seu novo ciclo seja repleto de autoconhecimento e crescimento. Conte com ela para essa jornada. 🎂`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro te deseja um dia maravilhoso, cheio de luz e comemoração. Que este novo ano te fortaleça ainda mais. ✨`,
        `Feliz aniversário, ${clientName}! A jornada da vida é única e a sua tem sido admirável. A Dra. Maria do Socorro te envia os melhores votos e está à disposição para te acompanhar. 🎈`,
        `Que seu dia seja tão incrível quanto você, ${clientName}! A Dra. Maria do Socorro te deseja um feliz aniversário e um novo ano de vida com muita paz e realizações. 😊`,
        `Feliz aniversário, ${clientName}! Que a alegria e a paz que você busca na sua jornada de autoconhecimento se multipliquem neste novo ano de vida. A Dra. Maria do Socorro tem um enorme carinho por você.`,
        `Parabéns, ${clientName}! Hoje é o seu dia, e a Dra. Maria do Socorro deseja que ele seja tão especial e cheio de realizações quanto você.`,
        `Feliz Aniversário, ${clientName}! Que sua vida seja um mar de realizações. A Dra. Maria do Socorro deseja que você continue florescendo.`,
        `Neste dia especial, a Dra. Maria do Socorro deseja que você, ${clientName}, encontre mais motivos para sorrir e se orgulhar da pessoa incrível que se tornou.`,
        `Feliz Aniversário, ${clientName}! Que o seu novo ciclo de vida seja cheio de paz, amor-próprio e descobertas. Conte sempre com a Dra. Maria do Socorro.`,
        `Comemore cada passo, ${clientName}! A Dra. Maria do Socorro deseja que seu aniversário seja o início de uma nova fase de muita evolução e felicidade.`,
        `Que a felicidade te acompanhe sempre, ${clientName}! A Dra. Maria do Socorro te deseja um feliz aniversário e um ano novo de vida com muita serenidade.`,
        `Feliz aniversário, ${clientName}! Que sua jornada de vida seja repleta de alegrias, e que você se conecte cada vez mais com sua essência. Abraços da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a celebração do seu aniversário seja um lembrete do quanto sua vida é valiosa. A Dra. Maria do Socorro te envia os melhores votos.`,
        `Dra. Maria do Socorro deseja um feliz aniversário, ${clientName}! Que a sua coragem e determinação te guiem em mais um ano de conquistas.`,
        `Feliz Aniversário, ${clientName}! Que a sua mente e coração estejam em harmonia neste novo ciclo. A Dra. Maria do Socorro te parabeniza por sua jornada.`,
        `Que o seu dia, ${clientName}, seja tão único e especial quanto você! A Dra. Maria do Socorro te deseja um aniversário repleto de luz.`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro deseja que você tenha um ano cheio de paz interior e crescimento contínuo.`,
        `Feliz Aniversário, ${clientName}! Que a vida te presenteie com momentos de pura alegria e com a sabedoria de valorizar cada um deles. Com carinho, Dra. Maria do Socorro.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que você encontre a força para superar qualquer obstáculo e celebre sua jornada.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um jardim de bons sentimentos. A Dra. Maria do Socorro te deseja um ano de felicidade e autodescoberta.`,
        `Parabéns, ${clientName}! Mais um ano se inicia para você, e a Dra. Maria do Socorro te parabeniza por sua resiliência e força. Feliz aniversário!`,
        `Que o seu aniversário seja o ponto de partida para a realização de todos os seus sonhos, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que você se permita ser feliz e que seu coração se encha de gratidão. A Dra. Maria do Socorro te envia um abraço.`,
        `A Dra. Maria do Socorro celebra sua existência, ${clientName}! Feliz aniversário e que a sua vida seja cheia de momentos inesquecíveis.`,
        `Feliz Aniversário, ${clientName}! Que a sua jornada de autoconhecimento te leve a um novo patamar de felicidade e realização. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a sua luz interior brilhe mais forte a cada dia. A Dra. Maria do Socorro deseja que seu aniversário seja repleto de amor.`,
        `Neste dia especial, ${clientName}, a Dra. Maria do Socorro te parabeniza e deseja que sua vida seja um constante aprendizado. Feliz Aniversário!`,
        `Feliz Aniversário, ${clientName}! Que a paz e a serenidade te acompanhem em todos os seus passos. Abraços da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que este novo ano te traga a clareza e a força que você precisa para alcançar seus objetivos. Dra. Maria do Socorro te deseja um feliz aniversário!`,
        `Feliz Aniversário, ${clientName}! A Dra. Maria do Socorro te parabeniza por sua coragem de ser quem você é. Que a sua vida seja cheia de conquistas.`,
        `Que a sua jornada de autoconhecimento continue te transformando em sua melhor versão, ${clientName}. Feliz Aniversário da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a vida te dê muitos motivos para celebrar. A Dra. Maria do Socorro te deseja um feliz aniversário e um ano de paz.`,
        `Feliz Aniversário, ${clientName}! Que seu novo ciclo de vida seja cheio de paz, amor e muita gratidão. A Dra. Maria do Socorro tem um enorme carinho por você.`,
        `A Dra. Maria do Socorro te parabeniza, ${clientName}! Que este dia seja o início de uma jornada de pura felicidade e realizações.`,
        `Que seu aniversário seja um momento de reflexão e gratidão, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um reflexo da sua força e beleza interior. Abraços da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a sua busca por autoconhecimento te leve a lugares incríveis. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Neste dia, a Dra. Maria do Socorro deseja que você, ${clientName}, celebre sua vida e se orgulhe de sua trajetória. Feliz Aniversário!`,
        `Feliz Aniversário, ${clientName}! Que a felicidade e a leveza se tornem parte do seu dia a dia. Com carinho, Dra. Maria do Socorro.`,
        `Que seu coração se encha de alegria, ${clientName}! A Dra. Maria do Socorro te deseja um aniversário inesquecível e um ano de grandes vitórias.`,
        `Parabéns, ${clientName}! Que a paz interior te acompanhe em mais um ano de vida. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um constante processo de evolução e felicidade. A Dra. Maria do Socorro te parabeniza por sua jornada.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que você se sinta amado, valorizado e cercado de boas energias.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um livro de histórias incríveis. Com os melhores votos da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro deseja que você continue cultivando a paz e a alegria em seu coração.`,
        `Que o seu aniversário seja o início de um ano de descobertas e de muita felicidade, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua mente e coração estejam sempre conectados à sua verdadeira essência. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a sua jornada de autoconhecimento seja cheia de momentos de pura alegria e crescimento. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Neste dia especial, a Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que a sua vida seja um reflexo da sua força interior.`,
        `Feliz Aniversário, ${clientName}! Que você se permita viver cada momento com intensidade. A Dra. Maria do Socorro te envia um abraço.`,
        `A Dra. Maria do Socorro celebra a sua vida, ${clientName}! Feliz Aniversário e que o seu novo ciclo seja de pura felicidade e realizações.`,
        `Feliz Aniversário, ${clientName}! Que o seu coração se encha de gratidão por mais um ano de vida. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a paz interior e a serenidade te acompanhem em todos os seus dias. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja uma melodia de felicidade e crescimento. A Dra. Maria do Socorro te deseja um ano de muita luz.`,
        `A Dra. Maria do Socorro te parabeniza, ${clientName}! Que você se sinta amado e acolhido neste dia especial. Feliz Aniversário!`,
        `Feliz Aniversário, ${clientName}! Que a sua jornada de autoconhecimento te leve a um novo patamar de felicidade. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a sua vida seja um constante processo de evolução. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Que a alegria de viver te acompanhe em mais um ano, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um livro de histórias incríveis. A Dra. Maria do Socorro te parabeniza por sua jornada.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que o seu novo ciclo seja de muita paz e prosperidade.`,
        `Feliz Aniversário, ${clientName}! Que a sua busca por autoconhecimento te leve a lugares incríveis. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro te deseja um ano de muitas conquistas e realizações. Feliz Aniversário!`,
        `Que a sua vida seja um reflexo da sua força e beleza interior, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a paz e a serenidade te acompanhem em todos os seus passos. Abraços da Dra. Maria do Socorro.`,
        `A Dra. Maria do Socorro te parabeniza, ${clientName}! Que a sua jornada de vida seja repleta de alegrias e de muita gratidão.`,
        `Feliz Aniversário, ${clientName}! Que a sua luz interior brilhe mais forte a cada dia. Com os melhores votos da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que o seu aniversário seja o ponto de partida para a realização de todos os seus sonhos. Com carinho, Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um constante processo de transformação. A Dra. Maria do Socorro te deseja um ano de pura felicidade.`,
        `Que a sua jornada seja cheia de momentos de pura alegria, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que o seu novo ciclo de vida seja cheio de paz, amor e de muita paz interior. Abraços da Dra. Maria do Socorro.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que a sua vida seja um reflexo da sua coragem e determinação.`,
        `Feliz Aniversário, ${clientName}! Que a sua busca por autoconhecimento te leve a um novo patamar de felicidade e paz. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a vida te presenteie com momentos de pura alegria e com a sabedoria de valorizar cada um deles. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Que o seu dia seja tão único e especial quanto você, ${clientName}! Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um constante processo de evolução e de muita felicidade. A Dra. Maria do Socorro te parabeniza por sua jornada.`,
        `A Dra. Maria do Socorro te parabeniza, ${clientName}! Que você continue cultivando a paz e a alegria em seu coração. Feliz Aniversário!`,
        `Feliz Aniversário, ${clientName}! Que a sua mente e coração estejam sempre em harmonia. Com os melhores votos da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro deseja que você tenha um ano cheio de paz interior e de muitas conquistas.`,
        `Que a sua vida seja um mar de realizações, ${clientName}. Com carinho, Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua jornada de autoconhecimento seja cheia de momentos de pura felicidade. A Dra. Maria do Socorro te envia um abraço.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que você se sinta amado, valorizado e cercado de boas energias.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um livro de histórias incríveis. Com os melhores votos da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro deseja que você continue cultivando a paz e a alegria em seu coração.`,
        `Que o seu aniversário seja o início de um ano de descobertas e de muita felicidade, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua mente e coração estejam sempre conectados à sua verdadeira essência. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a sua jornada de autoconhecimento seja cheia de momentos de pura alegria e crescimento. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Neste dia especial, a Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que a sua vida seja um reflexo da sua força interior.`,
        `Feliz Aniversário, ${clientName}! Que você se permita viver cada momento com intensidade. A Dra. Maria do Socorro te envia um abraço.`,
        `A Dra. Maria do Socorro celebra a sua vida, ${clientName}! Feliz Aniversário e que o seu novo ciclo seja de pura felicidade e realizações.`,
        `Feliz Aniversário, ${clientName}! Que o seu coração se encha de gratidão por mais um ano de vida. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a paz interior e a serenidade te acompanhem em todos os seus dias. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja uma melodia de felicidade e crescimento. A Dra. Maria do Socorro te deseja um ano de muita luz.`,
        `A Dra. Maria do Socorro te parabeniza, ${clientName}! Que você se sinta amado e acolhido neste dia especial. Feliz Aniversário!`,
        `Feliz Aniversário, ${clientName}! Que a sua jornada de autoconhecimento te leve a um novo patamar de felicidade. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a sua vida seja um constante processo de evolução. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Que a alegria de viver te acompanhe em mais um ano, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um livro de histórias incríveis. A Dra. Maria do Socorro te parabeniza por sua jornada.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que o seu novo ciclo seja de muita paz e prosperidade.`,
        `Feliz Aniversário, ${clientName}! Que a sua busca por autoconhecimento te leve a lugares incríveis. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! A Dra. Maria do Socorro te deseja um ano de muitas conquistas e realizações. Feliz Aniversário!`,
        `Que a sua vida seja um reflexo da sua força e beleza interior, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a paz e a serenidade te acompanhem em todos os seus passos. Abraços da Dra. Maria do Socorro.`,
        `A Dra. Maria do Socorro te parabeniza, ${clientName}! Que a sua jornada de vida seja repleta de alegrias e de muita gratidão.`,
        `Feliz Aniversário, ${clientName}! Que a sua luz interior brilhe mais forte a cada dia. Com os melhores votos da Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que o seu aniversário seja o ponto de partida para a realização de todos os seus sonhos. Com carinho, Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que a sua vida seja um constante processo de transformação. A Dra. Maria do Socorro te deseja um ano de pura felicidade.`,
        `Que a sua jornada seja cheia de momentos de pura alegria, ${clientName}. Com os melhores votos da Dra. Maria do Socorro.`,
        `Feliz Aniversário, ${clientName}! Que o seu novo ciclo de vida seja cheio de paz, amor e de muita paz interior. Abraços da Dra. Maria do Socorro.`,
        `A Dra. Maria do Socorro te deseja um feliz aniversário, ${clientName}! Que a sua vida seja um reflexo da sua coragem e determinação.`,
        `Feliz Aniversário, ${clientName}! Que a sua busca por autoconhecimento te leve a um novo patamar de felicidade e paz. Com carinho, Dra. Maria do Socorro.`,
        `Parabéns, ${clientName}! Que a vida te presenteie com momentos de pura alegria e com a sabedoria de valorizar cada um deles. A Dra. Maria do Socorro te deseja um feliz aniversário.`,
        `Que o seu dia seja tão único e especial quanto você, ${clientName}! Com os melhores votos da Dra. Maria do Socorro.`,
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





