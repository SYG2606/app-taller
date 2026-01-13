import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, runTransaction, where, getDocs, setDoc } from 'firebase/firestore';
// SECCIÓN ACTUALIZADA DE ICONOS PARA CUBRIR TODAS LAS INDUSTRIAS
import { 
  Calendar, Clock, Wrench, User, LogOut, CheckCircle, XCircle, AlertCircle, 
  Bike, ClipboardList, Plus, Loader2, MessageCircle, Shield, Users, Lock, 
  Sun, Moon, Search, Settings, BarChart3, Printer, FileText, Timer, Store, 
  RotateCcw, Eye, EyeOff, Edit, History, Trash2, Image as ImageIcon, Upload, 
  ArrowRight, Filter, Layout, List, CalendarX, Mail, FileClock, Save,
  // Nuevos Iconos Agregados:
  Smartphone, Cpu, Laptop, // Tech
  Scissors, Sparkles, Gem, // Belleza
  Dumbbell, Trophy, Activity, // Deportes
  Stethoscope, Heart, Pill, // Salud
  Car, Key, // Automotriz
  PawPrint, Bone // Mascotas
} from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE (MANTENER IGUAL) ---
const firebaseConfig = {
  apiKey: "AIzaSyD5BVLXg7XUYm_B6cyv3hRIoYow1W0wWYg",
  authDomain: "turnos-bikes-app-98635.firebaseapp.com",
  projectId: "turnos-bikes-app-98635",
  storageBucket: "turnos-bikes-app-98635.firebasestorage.app",
  messagingSenderId: "93838557270",
  appId: "mi-taller-bici", 
};

// Inicialización segura de Firebase
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.error("Error inicializando Firebase:", e);
}

const appId = "mi-taller-bici"; // Puedes cambiar esto dinámicamente si escalas a SaaS real

// --- MAPA DE ICONOS DINÁMICOS ---
// Permite renderizar el icono correcto según la configuración guardada en texto
const IconMap = {
  Bike, Wrench,           // Bicis
  Smartphone, Cpu,        // Tech
  Scissors, Sparkles,     // Belleza
  Dumbbell, Trophy,       // Deportes
  Stethoscope, Heart,     // Salud
  Car, Key,               // Autos
  PawPrint, Bone          // Mascotas
};

// --- CONFIGURACIÓN MAESTRA MULTI-INDUSTRIA (SAAS) ---
const INDUSTRIES = {
  bikes: {
    label: "Taller de Bicicletas",
    itemLabel: "Modelo de Bici",    // Qué trae el cliente?
    staffLabel: "Mecánico",         // Quién atiende?
    actionLabel: "Reparar",         // Verbo de acción
    defaultServices: ["Mantenimiento General", "Revisión Frenos", "Armado de Bike", "Parchado", "Lavado"],
    icons: { item: 'Bike', staff: 'Wrench' }
  },
  tech: {
    label: "Servicio Técnico",
    itemLabel: "Dispositivo",
    staffLabel: "Técnico",
    actionLabel: "Reparar",
    defaultServices: ["Diagnóstico PC/Laptop", "Cambio de Pantalla", "Mantenimiento Software", "Recuperación de Datos", "Limpieza Interna"],
    icons: { item: 'Smartphone', staff: 'Cpu' }
  },
  beauty: {
    label: "Estética y Belleza",
    itemLabel: "Cliente / Preferencia",
    staffLabel: "Estilista",
    actionLabel: "Atender",
    defaultServices: ["Corte y Peinado", "Coloración", "Manicura/Pedicura", "Limpieza Facial", "Barbería"],
    icons: { item: 'Sparkles', staff: 'Scissors' }
  },
  sports: {
    label: "Complejo Deportivo",
    itemLabel: "Cancha / Espacio",
    staffLabel: "Instructor/Admin",
    actionLabel: "Reservar",
    defaultServices: ["Alquiler Cancha (60 min)", "Alquiler Cancha (90 min)", "Clase Grupal", "Entrenamiento Personal"],
    icons: { item: 'Trophy', staff: 'Dumbbell' }
  },
  health: {
    label: "Consultorio / Salud",
    itemLabel: "Paciente / Motivo",
    staffLabel: "Profesional",
    actionLabel: "Consultar",
    defaultServices: ["Consulta General", "Control", "Kinesiología", "Nutrición", "Análisis"],
    icons: { item: 'Heart', staff: 'Stethoscope' }
  },
  automotive: {
    label: "Taller Automotriz",
    itemLabel: "Vehículo",
    staffLabel: "Mecánico",
    actionLabel: "Revisar",
    defaultServices: ["Service 10k km", "Cambio de Aceite", "Alineación y Balanceo", "Revisión Frenos"],
    icons: { item: 'Car', staff: 'Wrench' }
  },
  pets: {
    label: "Veterinaria / Pet Shop",
    itemLabel: "Mascota",
    staffLabel: "Veterinario",
    actionLabel: "Tratar",
    defaultServices: ["Baño y Corte", "Consulta Veterinaria", "Vacunación", "Desparasitación"],
    icons: { item: 'PawPrint', staff: 'Bone' }
  }
};

const GENERIC_PASS = "Turno2026";

// --- HELPERS ---
const formatDateForQuery = (d) => d.toISOString().split('T')[0];
const formatDisplayDate = (d) => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return { dayName: days[d.getDay()], date: `${d.getDate()}/${d.getMonth()+1}` };
};

// --- COMPONENTES UI ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled, ...props }) => {
  const variants = {
    primary: 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-900/20 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 hover:border-slate-500 disabled:opacity-50',
    admin: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20 disabled:bg-slate-700',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 disabled:opacity-50',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 disabled:opacity-50',
    whatsapp: 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20 disabled:opacity-50',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-50'
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 relative z-10 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl relative z-0 ${className} ${onClick ? 'cursor-pointer hover:border-slate-600 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300' : ''}`}>
    {children}
  </div>
);

const Badge = ({ status }) => {
  const styles = {
    'pendiente': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'recibido': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'en-proceso': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'listo': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  };
  const labels = { 'pendiente': 'Reservado', 'recibido': 'En Taller', 'en-proceso': 'En Reparación', 'listo': 'Finalizado' };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles['pendiente']}`}>{labels[status] || status}</span>;
};

// --- APP PRINCIPAL ---
export default function App() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // States de carga
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Config
  const [shopConfig, setShopConfig] = useState({ 
    workDays: [1, 3, 5], 
    shopName: 'Turnos Bikes', 
    shopAddress: 'Calle Falsa 123', 
    shopPhone: '11 2233 4455', 
    maxPerDay: 4, 
    logoUrl: '', 
    lastOrderNumber: 1000,
    blockedDates: [],
    implementationDate: '', // Nueva config
    industry: 'bikes' // Valor por defecto
  });
  // Determinar la configuración actual basada en el estado
const activeIndustry = INDUSTRIES[shopConfig.industry] || INDUSTRIES.bikes;
// Determinar qué icono usar
const ItemIcon = IconMap[activeIndustry.icons.item];
const StaffIcon = IconMap[activeIndustry.icons.staff];
  const [configSuccess, setConfigSuccess] = useState(false);
  const [dateToBlock, setDateToBlock] = useState('');
const availableServices = shopConfig.customServices || activeIndustry.defaultServices;

  // Nav & Auth
  const [view, setView] = useState('login'); 
  const [subView, setSubView] = useState('dashboard'); 
  const [dashboardMode, setDashboardMode] = useState('list');
  const [isStaffLogin, setIsStaffLogin] = useState(false);
  const [loginStep, setLoginStep] = useState(1);
  const [loginDni, setLoginDni] = useState('');
  const [loginPassword, setLoginPassword] = useState(''); 
  const [loginError, setLoginError] = useState('');
  const [loginForm, setLoginForm] = useState({ name: '', phone: '', bikeModel: '', email: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Force Change Password
  const [tempStaffId, setTempStaffId] = useState(null);
  const [newPasswordForm, setNewPasswordForm] = useState({ new: '', confirm: '' });

  // Forms
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeBlock, setSelectedTimeBlock] = useState(null);
  const [apptNotes, setApptNotes] = useState('');
  const [clientBikeModel, setClientBikeModel] = useState('');
  // Usa el primer servicio de la industria activa por defecto
const [serviceType, setServiceType] = useState(
  (INDUSTRIES[shopConfig.industry || 'bikes'].defaultServices[0])
);
  
  // New Admin Appt Form State
  const [adminApptStep, setAdminApptStep] = useState(1); // 1: DNI, 2: Form
  const [adminDniSearch, setAdminDniSearch] = useState('');
  const [isNewClient, setIsNewClient] = useState(false);
  const [adminFormData, setAdminFormData] = useState({ 
    name: '', 
    bikeModel: '', 
    phone: '', 
    date: '', 
    // Usamos la lista dinámica de la industria activa
    serviceType: activeIndustry.defaultServices[0], 
    notes: '' 
});
  const [showAdminApptModal, setShowAdminApptModal] = useState(false);
  
  // Modals
  const [editingClient, setEditingClient] = useState(null); 
  const [clientHistoryModal, setClientHistoryModal] = useState(null); // Nuevo modal historial
  const [receptionModal, setReceptionModal] = useState(null); 
  const [confirmModal, setConfirmModal] = useState(null);
  const [rescheduleModal, setRescheduleModal] = useState(null);

  // Filters & Stats
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [statsPeriod, setStatsPeriod] = useState('month'); 

  // Staff Form
  const [newMechDni, setNewMechDni] = useState('');
  const [newMechName, setNewMechName] = useState('');
  const [newMechPassword, setNewMechPassword] = useState(GENERIC_PASS);
  const [newMechIsAdmin, setNewMechIsAdmin] = useState(false);

  
// Determinar servicios (si la config de la DB tiene servicios personalizados, úsalos, sino usa los default)
  // --- HOTFIX: Inyectar Tailwind CSS CDN ---
  useEffect(() => {
    const scriptId = 'tailwind-cdn-style';
    if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = "https://cdn.tailwindcss.com";
        script.async = true;
        document.head.appendChild(script);
    }
  }, []);

  // Init Auth
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { 
        console.error("Auth Error", err);
        try { await signInAnonymously(auth); } catch (e) {
             if (isMounted) {
                setAuthError(`No se pudo conectar con la base de datos. (${err.code || e.code})`);
                setLoading(false);
            }
        }
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (!isMounted) return;
      setUser(u);
      if (u) {
        const savedUser = localStorage.getItem('bikes_app_user_v8');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.dni) {
            setAppUser(parsed);
            setView(parsed.role === 'mechanic' ? 'mechanic-dashboard' : 'client-dashboard');
            if (parsed.role === 'client') setClientBikeModel(parsed.bikeModel || '');
          }
        }
      }
      setLoading(false);
    }, (err) => {
        if (isMounted) {
              setAuthError("Error de sesión: " + err.message);
              setLoading(false);
        }
    });
    return () => { isMounted = false; unsubscribe(); };
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user || !db) return;
    const unsub1 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), s => s.exists() && setShopConfig(p => ({...p, ...s.data()})));
    const unsub2 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'turnos')), s => setAppointments(s.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=>new Date(a.date)-new Date(b.date))));
    const unsub3 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'mechanics')), s => setMechanics(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub4 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'clients')), s => setClients(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user]);

  // --- LOGIC ---
  const handleLogout = () => {
      setAppUser(null);
      localStorage.removeItem('bikes_app_user_v8');
      setLoginDni(''); setLoginPassword(''); setLoginStep(1); setLoginError('');
      setView('login');
  };

  const saveConfig = async (newConfig = null) => {
      const configToSave = newConfig || shopConfig;
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), configToSave, { merge: true });
          setConfigSuccess(true); setTimeout(() => setConfigSuccess(false), 3000); 
      } catch (e) { alert("Error al guardar: " + e.message); }
  };

  const handleBlockDate = () => {
    if(!dateToBlock) return;
    const currentBlocked = shopConfig.blockedDates || [];
    if(!currentBlocked.includes(dateToBlock)){
        const updated = {...shopConfig, blockedDates: [...currentBlocked, dateToBlock].sort()};
        setShopConfig(updated);
        saveConfig(updated);
    }
    setDateToBlock('');
  };

  const handleUnblockDate = (dateToRemove) => {
      const updated = {...shopConfig, blockedDates: (shopConfig.blockedDates || []).filter(d => d !== dateToRemove)};
      setShopConfig(updated);
      saveConfig(updated);
  };

  const handleLogoUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 500 * 1024) { alert("Máximo 500KB."); return; }
      const reader = new FileReader();
      reader.onloadend = () => { setShopConfig(prev => ({ ...prev, logoUrl: reader.result })); };
      reader.readAsDataURL(file);
  };

  const generateOrderNumber = async () => {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main');
      try {
          return await runTransaction(db, async (t) => {
              const docSnap = await t.get(ref);
              const next = (docSnap.exists() ? (docSnap.data().lastOrderNumber || 1000) : 1000) + 1;
              t.set(ref, { lastOrderNumber: next }, { merge: true });
              return next;
          });
      } catch (e) { return Math.floor(Math.random()*9000)+1000; }
  };

  const createClientAppointment = async () => {
    if (isSubmitting) return; 
    if (!user) return alert("Error: No estás conectado al sistema. Recarga la página.");
    if (!selectedDate || !selectedTimeBlock) return alert("Falta fecha/hora");
    
    setIsSubmitting(true);
    
    try {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'turnos'), where('clientId', '==', user.uid), where('status', 'in', ['pendiente', 'recibido', 'en-proceso']));
        const snap = await getDocs(q);
        
        if (snap.size >= 2) {
            alert("Límite alcanzado: Ya tienes 2 turnos activos. Debes finalizar uno para reservar otro.");
            setIsSubmitting(false);
            return;
        }

        const d = new Date(selectedDate);
        if (selectedTimeBlock === 'morning') d.setHours(9); else d.setHours(18);
        
        const orderNum = await generateOrderNumber();
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'turnos'), {
            orderId: orderNum, clientId: user.uid, clientName: appUser.name, clientDni: appUser.dni, clientPhone: appUser.phone,
            bikeModel: clientBikeModel || appUser.bikeModel || 'No especificada', serviceType, date: d.toISOString(), dateString: formatDateForQuery(d),
            timeBlock: selectedTimeBlock, notes: apptNotes, status: 'pendiente', createdBy: 'client', createdAt: new Date().toISOString()
        });
        alert(`¡Turno #${orderNum} Reservado!`); setSelectedDate(null);

    } catch (e) { 
        console.error(e);
        alert("Error al reservar: " + e.message); 
    } finally {
        setIsSubmitting(false);
    }
  };

  // --- LOGICA NUEVA PARA ADMIN APPOINTMENT ---
  const handleAdminDniSearch = async (e) => {
      e.preventDefault();
      if(!adminDniSearch) return;
      
      const foundClient = clients.find(c => c.dni === adminDniSearch);
      
      if (foundClient) {
          setIsNewClient(false);
          setAdminFormData(prev => ({ ...prev, name: foundClient.name, phone: foundClient.phone, bikeModel: foundClient.bikeModel || '' }));
      } else {
          setIsNewClient(true);
          setAdminFormData(prev => ({ ...prev, name: '', phone: '', bikeModel: '' }));
      }
      setAdminApptStep(2);
  };

  const createAdminAppointment = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!user) return alert("Error: Sin conexión a base de datos.");
    if (!adminFormData.date || !adminFormData.phone || !adminFormData.bikeModel) return alert("Faltan datos");
    
    setIsSubmitting(true);
    try {
        let finalClientId = 'admin-created';
        
        // Si es cliente nuevo, crearlo en la DB
        if (isNewClient) {
            const clientDoc = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { 
                dni: adminDniSearch, 
                name: adminFormData.name, 
                phone: adminFormData.phone, 
                bikeModel: adminFormData.bikeModel,
                createdAt: new Date().toISOString() 
            });
            finalClientId = clientDoc.id; // Usamos el ID del doc
        } else {
            const existing = clients.find(c => c.dni === adminDniSearch);
            if (existing) finalClientId = existing.id;
        }

        const d = new Date(adminFormData.date);
        const orderNum = await generateOrderNumber();
        
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'turnos'), {
            orderId: orderNum, 
            clientId: finalClientId, // Importante para el historial
            clientName: adminFormData.name, 
            clientDni: adminDniSearch,
            clientPhone: adminFormData.phone, 
            bikeModel: adminFormData.bikeModel, 
            serviceType: adminFormData.serviceType,
            date: d.toISOString(), 
            dateString: formatDateForQuery(d), 
            notes: adminFormData.notes || 'Agendado por Staff', 
            status: 'pendiente', 
            createdBy: 'mechanic', 
            createdAt: new Date().toISOString()
        });
        
        alert(`Turno #${orderNum} creado.`); 
        setShowAdminApptModal(false); 
        setAdminApptStep(1);
        setAdminDniSearch('');
        setAdminFormData({ name: '', bikeModel: '', phone: '', date: '', serviceType: SERVICE_TYPES[0], notes: '' });
    } catch (e) { alert("Error al crear: " + e.message); }
    finally { setIsSubmitting(false); }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginDni || !loginPassword) return setLoginError("Faltan datos");
    setLoading(true);
    
    if (mechanics.length === 0) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'mechanics'), { dni: loginDni, name: 'Admin Inicial', password: loginPassword, isAdmin: true, forcePasswordChange: false, createdAt: new Date().toISOString() });
        finalizeLogin({ name: 'Admin Inicial', dni: loginDni, role: 'mechanic', isAdmin: true });
        return;
    }

    const mech = mechanics.find(m => m.dni === loginDni);
    if (mech && mech.password === loginPassword) {
        if (mech.forcePasswordChange) {
            setTempStaffId(mech.id); setAppUser({ name: mech.name, role: 'mechanic', isAdmin: !!mech.isAdmin });
            setView('force-change-password'); setLoading(false); return;
        }
        finalizeLogin({ name: mech.name, dni: loginDni, role: 'mechanic', isAdmin: !!mech.isAdmin });
    } else { setLoginError("Credenciales inválidas"); setLoading(false); }
  };

  const handleChangePassword = async (e) => {
      e.preventDefault();
      if (newPasswordForm.new !== newPasswordForm.confirm) return alert("No coinciden");
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mechanics', tempStaffId), { password: newPasswordForm.new, forcePasswordChange: false });
      alert("Clave actualizada."); finalizeLogin({ ...appUser, dni: loginDni });
  };

  const handleDniSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const snap = await getDocs(query(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), where('dni', '==', loginDni)));
    if (!snap.empty) finalizeLogin({ ...snap.docs[0].data(), role: 'client' });
    else { setLoginStep(2); setLoading(false); }
  };

  const handleRegisterSubmit = async (e) => {
      e.preventDefault(); setLoading(true);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { dni: loginDni, ...loginForm, createdAt: new Date().toISOString() });
      finalizeLogin({ dni: loginDni, ...loginForm, role: 'client' });
  };

  const finalizeLogin = (u) => {
      setAppUser(u); if(u.role === 'client') setClientBikeModel(u.bikeModel || '');
      localStorage.setItem('bikes_app_user_v8', JSON.stringify(u));
      setView(u.role === 'mechanic' ? 'mechanic-dashboard' : 'client-dashboard');
      setLoading(false);
  };

  const updateStatus = async (id, newStatus, extra = {}) => {
      const data = { status: newStatus, ...extra };
      if (newStatus === 'recibido') { data.arrivedAt = new Date().toISOString(); data.receivedBy = appUser.name; }
      if (newStatus === 'en-proceso') { data.startedAt = new Date().toISOString(); data.mechanicName = appUser.name; data.mechanicId = appUser.dni; }
      if (newStatus === 'listo') data.finishedAt = new Date().toISOString();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'turnos', id), data);
  };

  const handleReceptionConfirm = async (e) => {
      e.preventDefault();
      const { id, ...curr } = receptionModal.appt;
      const updates = { bikeModel: receptionModal.bikeModel, serviceType: receptionModal.serviceType, notes: receptionModal.notes };
      
      // 1. Actualizar DB
      await updateStatus(id, 'recibido', updates);
      
      // 2. Imprimir Orden con Troquel
      printServiceOrder({ ...curr, ...updates, id, orderId: receptionModal.appt.orderId, receivedBy: appUser.name });
      
      // 3. WhatsApp Automático
      // Construir mensaje de recepción
      const msg = `Hola ${receptionModal.appt.clientName}! 👋\n\nTu bici *${receptionModal.bikeModel}* ingresó al taller *${shopConfig.shopName}*.\n\n📋 Orden: #${receptionModal.appt.orderId}\n🔧 Servicio: ${receptionModal.serviceType}\n\nTe avisaremos cuando esté lista!`;
      const url = `https://wa.me/${receptionModal.appt.clientPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;
      
      // Abrir WhatsApp en nueva pestaña
      window.open(url, '_blank');
      
      setReceptionModal(null);
  };

  const handleDeleteAppointment = (id) => {
      setConfirmModal({
          title: 'Eliminar Turno',
          msg: '¿Estás seguro de eliminar este turno de forma permanente?',
          action: async () => {
              try {
                  await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'turnos', id));
                  setConfirmModal(null);
              } catch (e) { console.error(e); alert("Error: " + e.message); }
          }
      });
  };

  const openRescheduleModal = (appt, mode) => {
      if (mode === 'client') {
          const apptDate = new Date(appt.date);
          const now = new Date();
          const diffHours = (apptDate - now) / 36e5;
          if (diffHours < 48) {
              setConfirmModal({
                  title: 'No se puede reprogramar',
                  msg: 'Solo se permiten cambios con 48hs de anticipación. Por favor, contacta al taller.',
                  action: () => setConfirmModal(null)
              });
              return;
          }
      }
      setRescheduleModal({ appt, date: '', timeBlock: '' });
  };

  const handleRescheduleSubmit = async () => {
      if (!rescheduleModal.date || !rescheduleModal.timeBlock) return alert("Selecciona fecha y hora");
      const d = new Date(rescheduleModal.date);
      if (rescheduleModal.timeBlock === 'morning') d.setHours(9); else d.setHours(18);
      
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'turnos', rescheduleModal.appt.id), {
              date: d.toISOString(),
              dateString: formatDateForQuery(d),
              timeBlock: rescheduleModal.timeBlock
          });
          alert("Turno reprogramado correctamente.");
          setRescheduleModal(null);
      } catch (e) { alert("Error: " + e.message); }
  };

  const addMechanic = async (e) => {
      e.preventDefault();
      if(!user) return alert("Sin conexión. Recarga.");
      if(!newMechDni || !newMechName) return alert("Faltan datos");
      
      if (mechanics.some(m => m.dni === newMechDni)) return alert("DNI ya registrado");

      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'mechanics'), {
            dni: newMechDni, name: newMechName, password: newMechPassword, isAdmin: newMechIsAdmin, forcePasswordChange: true, createdAt: new Date().toISOString()
        });
        setNewMechDni(''); setNewMechName(''); setNewMechPassword(GENERIC_PASS); alert("Staff agregado correctamente.");
      } catch (err) { alert("Error al crear usuario: " + err.message); }
  };

  const handleUpdateClient = async (e) => {
      e.preventDefault();
      if (!editingClient) return;
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', editingClient.id), {
              name: editingClient.name, phone: editingClient.phone, bikeModel: editingClient.bikeModel
          });
          setEditingClient(null);
          alert("Cliente actualizado correctamente.");
      } catch (err) { console.error(err); alert("Error al actualizar cliente."); }
  };

  // --- FUNCIÓN DE IMPRESIÓN MEJORADA (CON TROQUEL) ---
  const printServiceOrder = (appt) => {
    const logoHtml = shopConfig.logoUrl ? `<img src="${shopConfig.logoUrl}" style="max-height:60px;display:block;margin:0 auto 10px"/>` : '';
    const now = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    
    const win = window.open('','','width=800,height=900');
    
    const styles = `
      body { font-family: 'Courier New', monospace; padding: 20px; max-width: 80mm; margin: 0 auto; }
      .container { border: 1px solid #000; padding: 10px; margin-bottom: 20px; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
      .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 12px; }
      .title { font-weight: bold; font-size: 14px; margin: 15px 0 5px 0; border-bottom: 1px dashed #999; }
      .big-id { text-align: center; font-size: 24px; font-weight: bold; margin: 10px 0; border: 2px solid #000; padding: 5px; }
      .cut-line { border-top: 2px dashed #000; margin: 30px 0; position: relative; text-align: center; }
      .cut-line:after { content: '✂ CORTAR AQUÍ - COPIA CLIENTE'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #fff; padding: 0 10px; font-size: 10px; }
      .footer { text-align: center; font-size: 10px; margin-top: 20px; }
      .disclaimer { font-size: 9px; text-align: justify; margin-top: 10px; }
      @media print { body { width: 100%; max-width: none; } }
    `;

    const content = `
      <html><head><title>Orden #${appt.orderId}</title><style>${styles}</style></head>
      <body>
        <!-- COPIA TALLER -->
        <div class="container">
            <div class="header">
                ${logoHtml}
                <h2 style="margin:0">${shopConfig.shopName}</h2>
                <div style="font-size:10px">${shopConfig.shopAddress}</div>
            </div>
            
            <div class="big-id">ORDEN #${appt.orderId}</div>
            
            <div class="title">DATOS CLIENTE</div>
            <div class="row"><span>Cliente:</span><strong>${appt.clientName}</strong></div>
            <div class="row"><span>DNI:</span><span>${appt.clientDni}</span></div>
            <div class="row"><span>Teléfono:</span><span>${appt.clientPhone}</span></div>
            
            <div class="title">DETALLE SERVICIO</div>
            <div class="row"><span>Modelo Bici:</span><strong>${appt.bikeModel}</strong></div>
            <div class="row"><span>Servicio:</span><span>${appt.serviceType}</span></div>
            <div class="row"><span>Ingreso:</span><span>${now} ${time}</span></div>
            <div class="row"><span>Recibió:</span><span>${appt.receivedBy || 'Staff'}</span></div>
            
            <div class="title">NOTAS / ESTADO</div>
            <p style="font-size:11px; margin:0">${appt.notes || 'Sin observaciones.'}</p>
            
            <div class="disclaimer">
               AUTORIZO LA REPARACIÓN ARRIBA DETALLADA. EL TALLER NO SE RESPONSABILIZA POR EFECTOS PERSONALES DEJADOS EN LA BICICLETA. PASADOS 30 DÍAS SE COBRARÁ ESTADÍA.
            </div>
            <br/><br/>
            <div class="row" style="margin-top:20px"><span>________________</span><span>________________</span></div>
            <div class="row"><span>Firma Cliente</span><span>Firma Taller</span></div>
        </div>

        <!-- LINEA DE CORTE -->
        <div class="cut-line"></div>

        <!-- COPIA CLIENTE (TALÓN) -->
        <div class="container" style="border-style: dashed;">
            <div class="header" style="border:none; padding-bottom:0">
                <h3 style="margin:0">${shopConfig.shopName}</h3>
                <div style="font-size:11px">Comprobante de Recepción</div>
            </div>
            
            <div class="big-id" style="font-size:18px">#${appt.orderId}</div>
            
            <div class="row"><span>Fecha:</span><span>${now}</span></div>
            <div class="row"><span>Recibimos:</span><strong>${appt.bikeModel}</strong></div>
            <div class="row"><span>Atendido por:</span><span>${appt.receivedBy || 'Staff'}</span></div>
            <br/>
            <div style="text-align:center; font-weight:bold; font-size:12px">
                CONTACTO TALLER
            </div>
            <div class="row" style="justify-content:center"><span>📞 ${shopConfig.shopPhone}</span></div>
            <div class="row" style="justify-content:center"><span>📍 ${shopConfig.shopAddress}</span></div>
            <div class="footer">Conserve este talón para retirar.</div>
        </div>
      </body></html>
    `;
    
    win.document.write(content);
    win.document.close();
    // Esperar un momento para cargar imágenes si las hay
    setTimeout(() => {
        win.print();
    }, 500);
  };

  const getFilteredAppointments = () => {
    const term = searchTerm.toLowerCase();
    return appointments.filter(a => {
        const orderStr = a.orderId ? a.orderId.toString() : '';
        const match = orderStr.includes(term) || a.clientName.toLowerCase().includes(term) || a.bikeModel.toLowerCase().includes(term) || a.clientDni.includes(term);
        const status = statusFilter === 'all' || a.status === statusFilter;
        let date = true;
        if (dateFilterStart) date = new Date(a.date) >= new Date(dateFilterStart);
        return match && status && date;
    });
  };

  const getStatsAppointments = () => {
      const now = new Date();
      return appointments.filter(a => {
          if (statsPeriod === 'all') return true;
          const apptDate = new Date(a.date);
          if (statsPeriod === 'month') return apptDate.getMonth() === now.getMonth() && apptDate.getFullYear() === now.getFullYear();
          if (statsPeriod === 'week') {
              const diffTime = Math.abs(now - apptDate);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= 7;
          }
          return true;
      });
  };

  const renderDateSelector = (onSelect, currentSelected) => {
    const dates = []; let d = new Date(); d.setDate(d.getDate()+1);
    let loops = 0;
    while (dates.length < 6 && loops < 60) { 
        const dateStr = formatDateForQuery(d);
        // Verificar feriados
        const isBlocked = shopConfig.blockedDates && shopConfig.blockedDates.includes(dateStr);
        // Verificar días laborables
        if(shopConfig.workDays.includes(d.getDay())) {
             // Solo agregar si NO está bloqueado, o agregar marcado como bloqueado (preferimos mostrarlo bloqueado para feedback)
             dates.push({ date: new Date(d), isBlocked, dateStr }); 
        }
        d.setDate(d.getDate()+1); loops++;
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {dates.map((item,i) => {
            const { date: d, isBlocked, dateStr: ds } = item;
            const count = appointments.filter(a=>a.dateString===ds && a.status!=='cancelado').length;
            const full = count >= shopConfig.maxPerDay;
            const sel = currentSelected && formatDateForQuery(currentSelected) === ds;
            
            let statusText = `${shopConfig.maxPerDay-count} libres`;
            let statusColor = 'text-emerald-400';
            if (isBlocked) { statusText = 'Cerrado'; statusColor = 'text-red-400'; }
            else if (full) { statusText = 'Agotado'; statusColor = 'text-red-400'; }

            return (
                <button key={i} onClick={()=>!full && !isBlocked && onSelect(d)} disabled={full || isBlocked} 
                    className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden
                        ${(full || isBlocked) ? 'bg-slate-800/50 border-slate-700 opacity-60 cursor-not-allowed' : sel ? 'bg-orange-600 border-orange-500 ring-2 ring-orange-500/30 shadow-lg' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}
                    `}
                >
                    {isBlocked && <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center -rotate-12 pointer-events-none"><span className="text-red-500/50 font-bold border-2 border-red-500/50 px-2 py-1 rounded text-xs uppercase">No Laborable</span></div>}
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-sm font-bold ${(full||isBlocked)?'text-slate-500':'text-white'}`}>{formatDisplayDate(d).dayName}</span>
                        {(full||isBlocked) ? <XCircle size={14} className="text-red-500"/> : <CheckCircle size={14} className="text-emerald-500"/>}
                    </div>
                    <div className="text-xs text-slate-300">{formatDisplayDate(d).date}</div>
                    <div className={`mt-2 text-xs font-semibold ${statusColor}`}>{statusText}</div>
                </button>
            )
        })}
      </div>
    );
  };

  const sendWhatsApp = (phone, name, bike, status) => {
    if (!phone) { alert("Sin teléfono."); return; }
    let msg = `Hola ${name}, mensaje de ${shopConfig.shopName} sobre tu ${bike}.`;
    if (status === 'listo') msg = `Hola ${name}! 👋 Tu *${bike}* ya está lista para retirar en ${shopConfig.shopName}. 🚲\nHorarios: Lun a Vie 9-18hs.`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printList = () => {
    const list = getFilteredAppointments();
    const content = `<html><head><title>Reporte</title><style>table{width:100%;border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Reporte Turnos</h1><table><thead><tr><th>Orden</th><th>Fecha</th><th>Cliente</th><th>Bici</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>${list.map(a=>`<tr><td>${a.orderId ? '#'+a.orderId : a.id.slice(0,6)}</td><td>${new Date(a.date).toLocaleDateString()}</td><td>${a.clientName}</td><td>${a.bikeModel}</td><td>${a.serviceType}</td><td>${a.status}</td></tr>`).join('')}</tbody></table></body></html>`;
    const win = window.open('','','width=900,height=600'); win.document.write(content); win.document.close(); win.print();
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-orange-500 gap-2"><Loader2 className="animate-spin"/> Cargando...</div>;

  if (authError) return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <AlertCircle size={48} className="text-red-500 mb-4"/>
        <h2 className="text-xl font-bold mb-2">Error de Sistema</h2>
        <p className="text-slate-400 text-center">{authError}</p>
        <p className="text-xs text-slate-600 mt-4 text-center">Verifica que "localhost" o tu dominio estén autorizados en Firebase.</p>
    </div>
  );

  if (view === 'force-change-password') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4"><div className="max-w-md w-full"><div className="text-center mb-8"><div className="w-20 h-20 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce shadow-xl shadow-orange-900/40"><Lock size={36} className="text-white"/></div><h1 className="text-2xl font-bold text-white">Cambio Obligatorio</h1><p className="text-slate-400 mt-2">Por seguridad, actualiza tu contraseña temporal.</p></div><Card className="border-orange-500/30"><form onSubmit={handleChangePassword} className="space-y-4"><input type="password" required className="w-full bg-slate-900/50 text-white rounded-lg p-3 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" value={newPasswordForm.new} onChange={e=>setNewPasswordForm({...newPasswordForm,new:e.target.value})} placeholder="Nueva Clave" /><input type="password" required className="w-full bg-slate-900/50 text-white rounded-lg p-3 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" value={newPasswordForm.confirm} onChange={e=>setNewPasswordForm({...newPasswordForm,confirm:e.target.value})} placeholder="Confirmar" /><Button type="submit" className="w-full mt-4 py-3">Actualizar Clave</Button></form></Card></div></div>
  );

  const Header = () => (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 transition-all"><div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`p-2 rounded-xl w-10 h-10 flex items-center justify-center overflow-hidden shadow-lg ${appUser.role==='mechanic'?'bg-gradient-to-br from-blue-600 to-blue-700':'bg-gradient-to-br from-orange-600 to-orange-700'}`}>{shopConfig.logoUrl?<img src={shopConfig.logoUrl} className="w-full h-full object-cover"/>:<Bike size={24} className="text-white"/>}</div><div><h1 className="text-lg font-bold text-white leading-tight tracking-tight">{shopConfig.shopName}</h1><p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{appUser.role==='client'?'Cliente':(appUser.isAdmin?'Admin':'Mecánico')}</p></div></div><div className="flex items-center gap-4"><div className="hidden sm:block text-right"><p className="text-sm text-white font-medium">{appUser.name}</p><p className="text-xs text-slate-500">{appUser.dni}</p></div><Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800"><LogOut size={20}/></Button></div></div></header>
  );

  if (view === 'login') return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-all duration-700 ${isStaffLogin?'bg-slate-950':'bg-slate-900'}`}><div className="max-w-md w-full"><div className="text-center mb-8"><div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl transition-all duration-500 ${isStaffLogin?'bg-blue-600 shadow-blue-900/40':'bg-orange-600 shadow-orange-900/40'} overflow-hidden`}>{shopConfig.logoUrl?<img src={shopConfig.logoUrl} className="w-full h-full object-cover"/>:(isStaffLogin?<Shield size={48} className="text-white"/>:<Bike size={48} className="text-white"/>)}</div><h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{shopConfig.shopName}</h1><p className={`text-sm font-medium tracking-wide uppercase ${isStaffLogin?'text-blue-400':'text-slate-400'}`}>{isStaffLogin?'Acceso Administrativo':'Portal de Clientes'}</p></div><Card className={`${isStaffLogin?'border-blue-500/30':'border-slate-700'}`}>
        {isStaffLogin ? (
            <form onSubmit={handleStaffLogin} className="space-y-4">
                {mechanics.length===0 && <div className="bg-blue-500/10 border border-blue-500/50 p-4 rounded-xl mb-4 text-sm text-blue-200 text-center shadow-lg"><p className="font-bold mb-1">¡Bienvenido!</p>Serás el <strong>Primer Admin</strong>. Esta clave será la definitiva.</div>}
                <div className="space-y-4">
                  <input value={loginDni} onChange={e=>setLoginDni(e.target.value)} type="number" required className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" placeholder="Tu DNI" />
                  <div className="relative"><input value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} type={showPassword?"text":"password"} required className="w-full bg-slate-900/50 border-slate-700 border rounded-xl pl-3.5 pr-12 p-3.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600" placeholder="Tu Contraseña" /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"><Eye size={20}/></button></div>
                </div>
                {loginError && <p className="text-red-400 text-sm text-center font-medium animate-pulse bg-red-900/20 p-2 rounded-lg">{loginError}</p>}
                <Button type="submit" variant="admin" className="w-full py-3.5 text-lg shadow-blue-900/30">Ingresar al Sistema</Button>
            </form>
        ) : loginStep===1 ? (
            <form onSubmit={handleDniSubmit} className="space-y-6">
                <div className="text-center space-y-2"><h2 className="text-xl font-bold text-white">¡Hola! 👋</h2><p className="text-slate-400 text-sm">Ingresa tu DNI para ver o pedir turnos.</p></div>
                <input value={loginDni} onChange={e=>setLoginDni(e.target.value)} type="number" required className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-4 text-white text-lg text-center tracking-widest focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all placeholder:text-slate-600" placeholder="ej. 30123456" />
                <Button type="submit" className="w-full py-3.5 text-lg shadow-orange-900/30">Continuar <ArrowRight size={20}/></Button>
            </form>
        ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="text-center mb-2"><h2 className="text-xl font-bold text-white">Crea tu Perfil 🚲</h2><p className="text-slate-400 text-xs">Solo te pediremos esto una vez.</p></div>
                <input value={loginForm.name} onChange={e=>setLoginForm({...loginForm,name:e.target.value})} required className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-3.5 text-white focus:ring-2 focus:ring-orange-500 outline-none transition-all" placeholder="Tu Nombre Completo" />
                <input value={loginForm.phone} onChange={e=>setLoginForm({...loginForm,phone:e.target.value})} className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-3.5 text-white focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Celular / WhatsApp" />
            <input 
  value={loginForm.bikeModel} 
  onChange={e=>setLoginForm({...loginForm,bikeModel:e.target.value})} 
  className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-3.5 text-white focus:ring-2 focus:ring-orange-500 outline-none" 
  placeholder={`${activeIndustry.itemLabel} (Opcional)`} 
/>
                {/* EMAIL OPCIONAL RECOMENDADO */}
                <input value={loginForm.email} onChange={e=>setLoginForm({...loginForm,email:e.target.value})} type="email" className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-3.5 text-white focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Email (Opcional)" />
                <Button type="submit" className="w-full py-3.5 mt-2">Registrarme</Button>
            </form>
        )}
        <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-center"><button onClick={()=>{setIsStaffLogin(!isStaffLogin);setLoginStep(1);setLoginDni('');setLoginPassword('');}} className="text-sm flex items-center gap-2 text-slate-500 hover:text-white transition-colors py-2 px-4 rounded-lg hover:bg-slate-800">{isStaffLogin?<>Volver al Acceso de Clientes</>:<><Lock size={14}/> Soy Personal del Taller</>}</button></div>
    </Card></div></div>
  );

  if (view === 'client-dashboard') return (
    <div className="min-h-screen bg-slate-950 pb-20"><Header /><main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-0">
        <div className="lg:col-span-2"><h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><span className="bg-orange-600/20 text-orange-500 p-2 rounded-lg"><Plus size={24}/></span> Reservar Nuevo Turno</h2><Card><div className="mb-8"><h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">1. Selecciona un Día</h3>{renderDateSelector(setSelectedDate, selectedDate)}</div>{selectedDate && <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500"><h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">2. Elige Horario</h3><div className="grid grid-cols-2 gap-4"><button onClick={()=>setSelectedTimeBlock('morning')} className={`p-5 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-300 ${selectedTimeBlock==='morning'?'bg-orange-600 border-orange-500 text-white shadow-orange-900/20 shadow-xl scale-[1.02]':'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'}`}><Sun size={28}/><span>Mañana</span><span className="text-xs opacity-60 font-mono bg-black/20 px-2 py-0.5 rounded">08:00 - 10:00</span></button><button onClick={()=>setSelectedTimeBlock('afternoon')} className={`p-5 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-300 ${selectedTimeBlock==='afternoon'?'bg-orange-600 border-orange-500 text-white shadow-orange-900/20 shadow-xl scale-[1.02]':'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'}`}><Moon size={28}/><span>Tarde</span><span className="text-xs opacity-60 font-mono bg-black/20 px-2 py-0.5 rounded">17:30 - 19:00</span></button></div></div>}{selectedDate && selectedTimeBlock && <div className="animate-in fade-in slide-in-from-top-4 duration-500"><h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">3. Confirmar Reserva</h3><div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-6"><div className="space-y-1"><label className="text-xs text-slate-400 font-semibold uppercase">Tu Bici (Puedes editarla):</label><input value={clientBikeModel} onChange={e=>setClientBikeModel(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="Ej: SLP 29 Pro" /></div><div className="space-y-1"><label className="text-xs text-slate-400 font-semibold uppercase">Servicio:</label><select value={serviceType} onChange={e=>setServiceType(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none">{availableServices.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div className="space-y-1"><label className="text-xs text-slate-400 font-semibold uppercase">Notas Adicionales:</label><textarea value={apptNotes} onChange={e=>setApptNotes(e.target.value)} rows="2" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none" placeholder="¿Algún ruido raro? ¿Detalle específico?"/></div></div><Button onClick={createClientAppointment} disabled={isSubmitting} className="w-full py-4 text-lg shadow-orange-900/40">{isSubmitting ? <span className="flex items-center gap-2"><Loader2 className="animate-spin"/> Reservando...</span> : 'Confirmar Reserva'}</Button></div>}</Card></div>
        <div className="lg:col-span-1 space-y-6"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><span className="bg-slate-800 text-slate-400 p-2 rounded-lg"><ClipboardList size={24}/></span> Mis Turnos</h2>{appointments.filter(a=>a.clientDni===appUser.dni).length===0?<div className="text-center py-16 bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-800"><Bike className="mx-auto text-slate-700 mb-4" size={64}/><p className="text-slate-500 font-medium">No tienes turnos activos.</p></div>:appointments.filter(a=>a.clientDni===appUser.dni).map(appt=>{
            const isFuture = new Date(appt.date) > new Date();
            return <Card key={appt.id} className="relative group overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Bike size={80}/></div><div className="flex flex-col gap-3 relative z-10"><div className="flex justify-between items-center mb-1"><Badge status={appt.status}/><span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">#{appt.orderId}</span></div><div><h3 className="text-lg font-bold text-white leading-tight">{appt.serviceType}</h3><p className="text-slate-400 text-sm mt-1">{appt.bikeModel}</p></div><div className="flex items-center gap-3 mt-2 bg-slate-900/60 p-3 rounded-xl text-sm text-slate-300 border border-slate-800"><Calendar size={16} className="text-orange-500"/><div className="flex flex-col leading-none"><span className="text-xs text-slate-500 font-bold uppercase">Fecha</span><span>{new Date(appt.date).toLocaleDateString()} • {appt.timeBlock==='morning'?'Mañana':'Tarde'}</span></div></div>{(appt.status === 'pendiente' && isFuture) && <Button variant="secondary" onClick={()=>openRescheduleModal(appt, 'client')} className="w-full text-xs mt-2 border-slate-700">Reprogramar (48hs)</Button>}</div></Card>
        })}</div>
        
        {/* Modal Reprogramar */}
        {rescheduleModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-lg relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setRescheduleModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-xl font-bold text-white mb-4">Reprogramar Turno</h3><div className="mb-4">{renderDateSelector((d)=>setRescheduleModal({...rescheduleModal, date: d}), rescheduleModal.date)}</div>{rescheduleModal.date && <div className="grid grid-cols-2 gap-4 mb-4"><button onClick={()=>setRescheduleModal({...rescheduleModal, timeBlock:'morning'})} className={`p-3 rounded-xl border text-center ${rescheduleModal.timeBlock==='morning'?'bg-orange-600 text-white border-orange-500':'bg-slate-800 text-slate-400 border-slate-700'}`}>Mañana</button><button onClick={()=>setRescheduleModal({...rescheduleModal, timeBlock:'afternoon'})} className={`p-3 rounded-xl border text-center ${rescheduleModal.timeBlock==='afternoon'?'bg-orange-600 text-white border-orange-500':'bg-slate-800 text-slate-400 border-slate-700'}`}>Tarde</button></div>}<Button onClick={handleRescheduleSubmit} className="w-full">Confirmar Cambio</Button></Card></div>}
        
        {/* Confirm Modal */}
        {confirmModal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-sm border-red-500/30 bg-slate-900 shadow-2xl"><div className="flex justify-center mb-4 text-red-500"><AlertCircle size={48} /></div><h3 className="text-xl font-bold text-white mb-2 text-center">{confirmModal.title}</h3><p className="text-slate-400 mb-6 text-center text-sm">{confirmModal.msg}</p><div className="flex gap-3"><Button variant={confirmModal.title.includes("No")?"secondary":"secondary"} onClick={()=>setConfirmModal(null)} className="flex-1 py-3">{confirmModal.title.includes("No")?"Entendido":"Cancelar"}</Button>{!confirmModal.title.includes("No") && <Button variant="danger" onClick={()=>{confirmModal.action();}} className="flex-1 py-3">Confirmar</Button>}</div></Card></div>}
    </main></div>
  );

  const filteredAppts = appointments.filter(a => {
      const term = searchTerm.toLowerCase();
      const match = (a.orderId||'').toString().includes(term) || a.clientName.toLowerCase().includes(term) || a.bikeModel.toLowerCase().includes(term) || a.clientDni.includes(term);
      const status = statusFilter === 'all' || a.status === statusFilter;
      let date = true;
      if (dateFilterStart) date = new Date(a.date) >= new Date(dateFilterStart);
      return match && status && date;
  });

  return (
    <div className="min-h-screen bg-slate-950 pb-20"><Header /><div className="max-w-7xl mx-auto px-4 mt-6 border-b border-slate-800 flex flex-wrap gap-2 overflow-x-auto pb-1"><button onClick={()=>setSubView('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subView==='dashboard'?'bg-blue-600 text-white shadow-lg shadow-blue-900/30':'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Panel de Turnos</button>{appUser.isAdmin && <><button onClick={()=>setSubView('clients')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subView==='clients'?'bg-blue-600 text-white shadow-lg shadow-blue-900/30':'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Users size={16}/> Clientes</button><button onClick={()=>setSubView('stats')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subView==='stats'?'bg-blue-600 text-white shadow-lg shadow-blue-900/30':'text-slate-400 hover:text-white hover:bg-slate-800'}`}><BarChart3 size={16}/> Estadísticas</button><button onClick={()=>setSubView('config')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subView==='config'?'bg-blue-600 text-white shadow-lg shadow-blue-900/30':'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Settings size={16}/> Config</button><button onClick={()=>setSubView('mechanics-mgmt')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subView==='mechanics-mgmt'?'bg-blue-600 text-white shadow-lg shadow-blue-900/30':'text-slate-400 hover:text-white hover:bg-slate-800'}`}><Shield size={16}/> Staff</button></>}</div>
    <main className="max-w-7xl mx-auto px-4 py-8 relative z-0">
        {confirmModal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-sm border-red-500/30 bg-slate-900 shadow-2xl"><div className="flex justify-center mb-4 text-red-500"><AlertCircle size={48} /></div><h3 className="text-xl font-bold text-white mb-2 text-center">{confirmModal.title}</h3><p className="text-slate-400 mb-6 text-center text-sm">{confirmModal.msg}</p><div className="flex gap-3"><Button variant={confirmModal.title.includes("No")?"secondary":"secondary"} onClick={()=>setConfirmModal(null)} className="flex-1 py-3">{confirmModal.title.includes("No")?"Entendido":"Cancelar"}</Button>{!confirmModal.title.includes("No") && <Button variant="danger" onClick={()=>{confirmModal.action();}} className="flex-1 py-3">Confirmar</Button>}</div></Card></div>}
        
        {/* REUTILIZAMOS MODAL REPROGRAMACION PARA ADMIN */}
        {rescheduleModal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-lg relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setRescheduleModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-xl font-bold text-white mb-4">Reprogramar Turno (Admin)</h3><div className="mb-4">{renderDateSelector((d)=>setRescheduleModal({...rescheduleModal, date: d}), rescheduleModal.date)}</div>{rescheduleModal.date && <div className="grid grid-cols-2 gap-4 mb-4"><button onClick={()=>setRescheduleModal({...rescheduleModal, timeBlock:'morning'})} className={`p-3 rounded-xl border text-center ${rescheduleModal.timeBlock==='morning'?'bg-orange-600 text-white border-orange-500':'bg-slate-800 text-slate-400 border-slate-700'}`}>Mañana</button><button onClick={()=>setRescheduleModal({...rescheduleModal, timeBlock:'afternoon'})} className={`p-3 rounded-xl border text-center ${rescheduleModal.timeBlock==='afternoon'?'bg-orange-600 text-white border-orange-500':'bg-slate-800 text-slate-400 border-slate-700'}`}>Tarde</button></div>}<Button onClick={handleRescheduleSubmit} className="w-full">Confirmar Cambio</Button></Card></div>}

        {/* MODAL NUEVO TURNO ADMIN (INTELIGENTE) */}
        {showAdminApptModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-lg relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setShowAdminApptModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button>
            <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Plus className="text-blue-500"/> Nuevo Turno Manual</h3>
            {adminApptStep === 1 ? (
                <form onSubmit={handleAdminDniSearch} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ingrese DNI Cliente</label><div className="flex gap-2"><input autoFocus value={adminDniSearch} onChange={e=>setAdminDniSearch(e.target.value)} type="number" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition text-lg tracking-wider" placeholder="Ej: 30123456" /><Button type="submit" variant="admin"><Search size={20}/></Button></div><p className="text-xs text-slate-500 mt-2">Buscará si el cliente existe. Si no, podrás crearlo.</p></div>
                </form>
            ) : (
                <form onSubmit={createAdminAppointment} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700 flex justify-between items-center mb-4"><div className="flex items-center gap-2"><User size={16} className="text-blue-400"/><span className="text-white font-bold">{adminDniSearch}</span></div>{isNewClient ? <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded border border-orange-500/30">Nuevo Cliente</span> : <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">Cliente Existente</span>}</div>
                    <div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo</label><input required value={adminFormData.name} onChange={e=>setAdminFormData({...adminFormData, name:e.target.value})} className={`w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition ${!isNewClient ? 'opacity-80' : ''}`} placeholder="Nombre y Apellido" /></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono</label><input required value={adminFormData.phone} onChange={e=>setAdminFormData({...adminFormData, phone:e.target.value})} type="tel" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" placeholder="WhatsApp" /></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bicicleta</label><input value={adminFormData.bikeModel} onChange={e=>setAdminFormData({...adminFormData, bikeModel:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" placeholder="Modelo" /></div></div>
                    <div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</label><input type="datetime-local" required value={adminFormData.date} onChange={e=>setAdminFormData({...adminFormData, date:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white [color-scheme:dark] outline-none focus:border-blue-500 transition" /></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Servicio</label><select value={adminFormData.serviceType} onChange={e=>setAdminFormData({...adminFormData, serviceType:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition">{availableServices.map(s=><option key={s} value={s}>{s}</option>)}</select></div></div>
                    <Button type="submit" variant="admin" disabled={isSubmitting} className="w-full py-4 text-lg mt-4">{isSubmitting ? 'Guardando...' : (isNewClient ? 'Crear Cliente y Turno' : 'Agendar Turno')}</Button>
                    <button type="button" onClick={()=>setAdminApptStep(1)} className="w-full text-center text-xs text-slate-500 hover:text-white mt-2">Volver atrás</button>
                </form>
            )}
        </Card></div>}

        {subView === 'dashboard' && <>
            {receptionModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-lg relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setReceptionModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-2xl font-bold text-white mb-2">Recepción de Bicicleta</h3><div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl mb-6 flex items-center gap-3"><User className="text-blue-400"/><div className="text-sm"><p className="text-blue-200 font-bold">{receptionModal.appt.clientName}</p><p className="text-blue-400/60">DNI: {receptionModal.appt.clientDni}</p></div></div><form onSubmit={handleReceptionConfirm} className="space-y-5"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
  {activeIndustry.itemLabel} (Verificar)
</label><input value={receptionModal.bikeModel} onChange={e=>setReceptionModal({...receptionModal, bikeModel:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition"/></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Servicio a Realizar</label><select value={receptionModal.serviceType} onChange={e=>setReceptionModal({...receptionModal, serviceType:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition">{availableServices.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notas / Diagnóstico Visual</label><textarea value={receptionModal.notes} onChange={e=>setReceptionModal({...receptionModal, notes:e.target.value})} rows="3" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition resize-none" placeholder="Rayones, estado general..."/></div><Button type="submit" className="w-full py-4 text-lg mt-2">Confirmar e Imprimir Orden</Button></form></Card></div>}
            
            <div className="mb-8 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4 shadow-inner">
                <div className="md:col-span-4 relative"><Search className="absolute left-4 top-3.5 text-slate-500" size={20}/><input placeholder="Buscar ID, Cliente, Bici..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl pl-12 p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"/></div>
                <div className="md:col-span-3"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 cursor-pointer"><option value="all">Todos los Estados</option><option value="pendiente">Pendientes</option><option value="recibido">En Espera (Taller)</option><option value="en-proceso">En Reparación</option><option value="listo">Terminados</option></select></div>
                <div className="md:col-span-3 flex gap-2">
                    <button onClick={()=>setDashboardMode('list')} className={`flex-1 flex items-center justify-center rounded-xl transition ${dashboardMode==='list'?'bg-blue-600 text-white':'bg-slate-800 text-slate-400'}`}><List size={20}/></button>
                    <button onClick={()=>setDashboardMode('board')} className={`flex-1 flex items-center justify-center rounded-xl transition ${dashboardMode==='board'?'bg-blue-600 text-white':'bg-slate-800 text-slate-400'}`}><Layout size={20}/></button>
                </div>
                <div className="md:col-span-2"><Button variant="secondary" onClick={printList} className="w-full h-full flex gap-2 items-center justify-center bg-slate-800 border-slate-700 hover:bg-slate-700"><Printer size={18}/> Reporte</Button></div>
            </div>
            
            {dashboardMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    <div className="group h-full">
                        <Card onClick={()=>{setAdminApptStep(1); setShowAdminApptModal(true)}} className="h-full border-2 border-dashed border-slate-700 bg-slate-800/30 hover:bg-slate-800/80 hover:border-blue-500/50 flex flex-col justify-center items-center gap-4 transition-all duration-300 group cursor-pointer">
                            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-300 shadow-xl"><Plus size={40} className="text-slate-600 group-hover:text-white transition-colors"/></div>
                            <div className="text-center"><h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">Nuevo Turno</h3><p className="text-slate-500 text-sm">Agendar Manualmente</p></div>
                        </Card>
                    </div>
                    {filteredAppts.map(appt=><Card key={appt.id} className={`flex flex-col relative overflow-hidden ${appt.status==='listo'?'border-emerald-500/30 bg-emerald-900/5':''}`}><div className={`absolute top-0 left-0 w-1 h-full ${appt.status==='listo'?'bg-emerald-500':appt.status==='en-proceso'?'bg-blue-500':appt.status==='recibido'?'bg-amber-500':'bg-slate-600'}`}></div><div className="pl-3"><div className="flex justify-between items-start mb-3"><div><h3 className="text-white font-bold text-lg leading-tight line-clamp-1" title={appt.bikeModel}>{appt.bikeModel}</h3><div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1.5 font-medium"><User size={12} className="text-slate-500"/> {appt.clientName}</div><div className="text-[10px] text-slate-500 mt-1 font-mono bg-slate-900/50 w-fit px-1.5 py-0.5 rounded">ID: #{appt.orderId || appt.id.slice(0,4)}</div></div><Badge status={appt.status}/></div><div className="flex-grow space-y-3 mb-5"><div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/50"><p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-1">Servicio</p><p className="text-slate-300 text-sm font-medium line-clamp-2">{appt.serviceType}</p></div><div className="flex flex-wrap gap-2 text-xs text-slate-400"><span className="bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800 flex items-center gap-1.5"><Calendar size={12} className="text-slate-500"/> {new Date(appt.date).toLocaleDateString()}</span></div>{appt.mechanicName && <div className="text-xs text-slate-300 flex items-center gap-1.5 bg-blue-900/10 px-2 py-1 rounded border border-blue-900/20 w-fit"><Wrench size={10} className="text-blue-400"/> {appt.mechanicName}</div>}{appt.receivedBy && <div className="text-xs text-slate-300 flex items-center gap-1.5 mt-1 opacity-70">Recibido por: {appt.receivedBy}</div>}</div><div className="border-t border-slate-700/50 pt-4 grid gap-2">{appt.status==='pendiente' && <Button variant="secondary" className="text-xs w-full py-2.5 bg-slate-800 hover:bg-slate-700 border-slate-700" onClick={()=>setReceptionModal({appt, bikeModel:appt.bikeModel, serviceType:appt.serviceType, notes:appt.notes||''})}><FileText size={14}/> Recepcionar & Imprimir</Button>}{appt.status==='recibido' && <Button variant="admin" className="text-xs w-full py-2.5" onClick={()=>updateStatus(appt.id,'en-proceso')}><Wrench size={14}/> Iniciar Reparación</Button>}{appt.status==='en-proceso' && <Button variant="success" className="text-xs w-full py-2.5" onClick={()=>updateStatus(appt.id,'listo')}><CheckCircle size={14}/> Finalizar Trabajo</Button>}{appt.status==='listo' && <Button variant="whatsapp" className="text-xs w-full py-2.5" onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)}><MessageCircle size={14}/> Avisar Retiro</Button>}<div className="flex justify-between pt-2 mt-1 relative z-10"><button onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)} className="p-2 rounded-lg bg-slate-800 hover:bg-green-500/20 text-slate-400 hover:text-green-500 transition-colors border border-slate-700 hover:border-green-500/30" title="WhatsApp"><MessageCircle size={16}/></button>{appt.status!=='pendiente'&&<button onClick={()=>printServiceOrder(appt)} className="p-2 rounded-lg bg-slate-800 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors border border-slate-700 hover:border-blue-500/30" title="Reimprimir"><Printer size={16}/></button>}<button onClick={()=>updateStatus(appt.id,'pendiente')} className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors border border-slate-700 hover:border-red-500/30" title="Resetear"><RotateCcw size={16}/></button><button onClick={()=>openRescheduleModal(appt, 'admin')} className="p-2 rounded-lg bg-slate-800 hover:bg-orange-500/20 text-slate-400 hover:text-orange-400 transition-colors border border-slate-700 hover:border-orange-500/30" title="Reasignar Fecha"><Edit size={16}/></button><button onClick={()=>handleDeleteAppointment(appt.id)} className="p-2 rounded-lg bg-red-900/20 hover:bg-red-900/40 text-red-500 hover:text-red-400 transition-colors border border-red-500/30" title="Eliminar"><Trash2 size={16}/></button></div></div></div></Card>)}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full overflow-x-auto pb-4">
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800 min-w-[300px]">
                        <h3 className="text-slate-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-500"></div> En Espera / Recepción</h3>
                        <div className="space-y-3">
                            {filteredAppts.filter(a=>['pendiente','recibido'].includes(a.status)).map(appt=>(
                                <div key={appt.id} className="bg-slate-800 p-3 rounded-xl border border-slate-700 shadow-sm hover:border-slate-500 transition cursor-pointer" onClick={()=>appt.status==='recibido' && updateStatus(appt.id,'en-proceso')}>
                                    <div className="flex justify-between mb-1"><span className="text-white font-bold">{appt.bikeModel}</span><span className="text-xs text-slate-500">#{appt.orderId}</span></div>
                                    <p className="text-xs text-slate-400 mb-2">{appt.clientName}</p>
                                    <Badge status={appt.status}/>
                                    {appt.status==='pendiente' && <div className="mt-2 text-xs text-orange-400 bg-orange-900/20 px-2 py-1 rounded">Esperando Recepción</div>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-blue-900/30 min-w-[300px]">
                        <h3 className="text-blue-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div> En Taller (Trabajando)</h3>
                        <div className="space-y-3">
                            {filteredAppts.filter(a=>a.status==='en-proceso').map(appt=>(
                                <div key={appt.id} className="bg-slate-800 p-3 rounded-xl border-l-4 border-l-blue-500 border-y border-r border-slate-700 shadow-lg cursor-pointer" onClick={()=>updateStatus(appt.id,'listo')}>
                                    <div className="flex justify-between mb-1"><span className="text-white font-bold">{appt.bikeModel}</span><span className="text-xs text-slate-500">#{appt.orderId}</span></div>
                                    <p className="text-xs text-slate-400 mb-2">{appt.clientName}</p>
                                    <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-900/20 px-2 py-1 rounded w-fit"><Wrench size={10}/> {appt.mechanicName || 'Mecánico'}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-2xl p-4 border border-emerald-900/30 min-w-[300px]">
                        <h3 className="text-emerald-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Listos para Retirar</h3>
                        <div className="space-y-3">
                            {filteredAppts.filter(a=>a.status==='listo').map(appt=>(
                                <div key={appt.id} className="bg-slate-800 p-3 rounded-xl border border-emerald-900/50 opacity-80 hover:opacity-100 transition">
                                    <div className="flex justify-between mb-1"><span className="text-white font-bold">{appt.bikeModel}</span><span className="text-xs text-slate-500">#{appt.orderId}</span></div>
                                    <p className="text-xs text-slate-400 mb-2">{appt.clientName}</p>
                                    <button onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)} className="w-full mt-2 text-xs bg-emerald-600/20 text-emerald-400 py-1.5 rounded hover:bg-emerald-600 hover:text-white transition flex items-center justify-center gap-1"><MessageCircle size={12}/> Avisar</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>}

        {subView === 'clients' && appUser.isAdmin && <div className="space-y-6">
            {editingClient && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-md relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setEditingClient(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-2xl font-bold text-white mb-6">Editar Cliente</h3><form onSubmit={handleUpdateClient} className="space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label><input value={editingClient.name} onChange={e=>setEditingClient({...editingClient,name:e.target.value})} className="w-full bg-slate-950 text-white rounded-xl p-3 border border-slate-800 focus:border-blue-500 outline-none transition"/></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label><input value={editingClient.phone} onChange={e=>setEditingClient({...editingClient,phone:e.target.value})} className="w-full bg-slate-950 text-white rounded-xl p-3 border border-slate-800 focus:border-blue-500 outline-none transition"/></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bici (Default)</label><input value={editingClient.bikeModel} onChange={e=>setEditingClient({...editingClient,bikeModel:e.target.value})} className="w-full bg-slate-950 text-white rounded-xl p-3 border border-slate-800 focus:border-blue-500 outline-none transition"/></div><Button type="submit" className="w-full py-3 mt-2">Guardar Cambios</Button></form></Card></div>}
            
            {/* Modal Historial Cliente */}
            {clientHistoryModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"><Card className="w-full max-w-4xl relative bg-slate-900 border-slate-700 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col"><button onClick={()=>setClientHistoryModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button>
                <div className="mb-6 flex items-center gap-4">
                    <div className="bg-blue-600/20 p-3 rounded-full"><History size={24} className="text-blue-400"/></div>
                    <div><h3 className="text-2xl font-bold text-white">{clientHistoryModal.name}</h3><p className="text-sm text-slate-400">Historial de Servicios</p></div>
                </div>
                <div className="overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-800 text-xs text-slate-400 uppercase tracking-wider sticky top-0"><tr><th className="p-3">Fecha</th><th className="p-3">Orden</th><th className="p-3">Servicio</th><th className="p-3">Bici</th><th className="p-3">Mecánico</th></tr></thead>
                        <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                            {appointments.filter(a => (a.clientId === clientHistoryModal.id || a.clientDni === clientHistoryModal.dni)).sort((a,b)=>new Date(b.date)-new Date(a.date)).map(hist => (
                                <tr key={hist.id} className="hover:bg-slate-800/50">
                                    <td className="p-3 font-mono text-xs">{new Date(hist.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-bold">#{hist.orderId}</td>
                                    <td className="p-3">{hist.serviceType}</td>
                                    <td className="p-3 text-slate-400">{hist.bikeModel}</td>
                                    <td className="p-3 text-slate-500 text-xs">{hist.mechanicName || '-'}</td>
                                </tr>
                            ))}
                            {appointments.filter(a => (a.clientId === clientHistoryModal.id || a.clientDni === clientHistoryModal.dni)).length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-500">Sin historial registrado.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </Card></div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{clients.map(client=>{
                const clientServices=appointments.filter(a=>(a.clientId===client.id || a.clientDni===client.dni) && a.status==='listo');
                const lastServiceDate=clientServices.length>0?new Date(Math.max(...clientServices.map(a=>new Date(a.date)))):null;
                return <Card key={client.id} className="relative group hover:border-slate-600 transition"><div className="flex items-start justify-between mb-4"><div className="flex items-center gap-3"><div className="bg-slate-800 p-3 rounded-full border border-slate-700 shadow-inner"><User size={24} className="text-slate-300"/></div><div><h3 className="font-bold text-white text-lg">{client.name}</h3><p className="text-xs text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded w-fit">DNI: {client.dni}</p></div></div><button onClick={()=>setEditingClient(client)} className="text-slate-600 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition"><Edit size={18}/></button></div>
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center"><div className="text-slate-500 mb-1 flex items-center justify-center gap-1 font-bold uppercase tracking-wider"><Wrench size={12}/> Servicios</div><div className="text-xl font-bold text-blue-400">{clientServices.length}</div></div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center"><div className="text-slate-500 mb-1 flex items-center justify-center gap-1 font-bold uppercase tracking-wider"><History size={12}/> Último</div><div className="text-sm font-medium text-slate-300">{lastServiceDate ? lastServiceDate.toLocaleDateString() : '-'}</div></div>
                </div>
                <div className="mt-4 flex gap-2">
                    <button onClick={()=>sendWhatsApp(client.phone,client.name,client.bikeModel||'bici','consulta')} className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-green-600 hover:text-white text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700 hover:border-green-500 shadow-sm"><MessageCircle size={16}/></button>
                    <button onClick={()=>setClientHistoryModal(client)} className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700 hover:border-blue-500 shadow-sm"><FileClock size={16}/> Historial</button>
                </div></Card>;
            })}</div></div>}

        {subView === 'mechanics-mgmt' && appUser.isAdmin && <div className="max-w-3xl mx-auto"><Card className="mb-8 border-blue-500/30 shadow-blue-900/10"><div className="flex items-center gap-3 mb-6"><div className="bg-blue-500/20 p-3 rounded-full"><Shield size={24} className="text-blue-400"/></div><h3 className="text-2xl font-bold text-white">Gestión de Staff</h3></div><form onSubmit={addMechanic} className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-900/50 p-5 rounded-2xl border border-slate-800 mb-4"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</label><input required value={newMechName} onChange={e=>setNewMechName(e.target.value)} className="w-full bg-slate-950 text-white rounded-xl p-3 text-sm border border-slate-800 focus:border-blue-500 outline-none" placeholder="Nombre"/></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DNI (Usuario)</label><input required value={newMechDni} onChange={e=>setNewMechDni(e.target.value)} type="number" className="w-full bg-slate-950 text-white rounded-xl p-3 text-sm border border-slate-800 focus:border-blue-500 outline-none" placeholder="DNI"/></div><div className="space-y-1 relative"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contraseña</label><input required value={newMechPassword} onChange={e=>setNewMechPassword(e.target.value)} type="text" className="w-full bg-slate-950 text-white rounded-xl p-3 text-sm border border-slate-800 focus:border-blue-500 outline-none" /><div className="absolute top-8 right-3 text-xs text-slate-600 select-none">Default</div></div><div className="md:col-span-3 flex items-center justify-between pt-2"><div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"><input type="checkbox" checked={newMechIsAdmin} onChange={e=>setNewMechIsAdmin(e.target.checked)} className="rounded border-slate-700 bg-slate-800 text-blue-600 w-4 h-4"/><label className="text-sm text-slate-300 font-medium">¿Permisos de Admin?</label></div><Button type="submit" variant="admin" className="px-8"><Plus size={18}/> Crear Usuario</Button></div></form></Card><div className="space-y-3">{mechanics.map(m=><div key={m.id} className="flex justify-between items-center bg-slate-800/80 backdrop-blur-sm p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition"><div className="flex items-center gap-4"><div className={`p-3 rounded-full ${m.isAdmin?'bg-blue-500/20 text-blue-400':'bg-slate-700 text-slate-400'}`}>{m.isAdmin?<Shield size={20}/>:<Wrench size={20}/>}</div><div><p className="text-white font-bold flex items-center gap-2 text-lg">{m.name}{m.isAdmin && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider font-bold">Admin</span>}</p><p className="text-sm text-slate-500 font-mono">DNI: {m.dni}</p></div></div><div className="flex gap-2"><Button variant="secondary" className="p-2.5 h-auto rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800" onClick={()=>triggerResetPassword(m.id, m.name)} title={`Resetear a ${GENERIC_PASS}`}><RotateCcw size={16}/></Button><Button variant="danger" className="p-2.5 h-auto rounded-lg" onClick={()=>triggerRemoveMechanic(m.id, m.name)}><Trash2 size={16}/></Button></div></div>)}</div></div>}
        
        {subView === 'config' && <div className="max-w-2xl mx-auto space-y-8">

            {/* --- SELECTOR DE INDUSTRIA (NUEVO) --- */}
            <Card className="border-blue-500/30 shadow-blue-900/10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Store size={24} className="text-blue-400"/> 
                        Rubro del Negocio
                    </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(INDUSTRIES).map(([key, config]) => {
                        // Obtenemos el icono dinámicamente
                        const IndustryIcon = IconMap[config.icons.item] || Store;
                        const isSelected = shopConfig.industry === key;
                        
                        return (
                            <button
                                key={key}
                                onClick={() => {
                                    // 1. Cambiamos la configuración
                                    setShopConfig({ ...shopConfig, industry: key });
                                    // 2. Reseteamos el servicio seleccionado para que no quede uno viejo
                                    setServiceType(config.defaultServices[0]);
                                }}
                                className={`
                                    relative p-4 rounded-xl border flex flex-col items-center gap-3 transition-all duration-300
                                    ${isSelected 
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/40 scale-105 z-10' 
                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white hover:border-slate-500'
                                    }
                                `}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2">
                                        <CheckCircle size={16} className="text-white"/>
                                    </div>
                                )}
                                <div className={`p-3 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-900'}`}>
                                    <IndustryIcon size={24} />
                                </div>
                                <div className="text-center">
                                    <span className="block font-bold text-sm">{config.label}</span>
                                    <span className="text-[10px] opacity-70 uppercase tracking-wider">
                                        {config.staffLabel}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Card>
            {/* --- FIN SELECTOR --- */}

            <Card>
                <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings size={24} className="text-slate-400"/> Configuración del Taller</h3>{configSuccess && <span className="text-emerald-400 text-sm font-bold animate-in fade-in bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-500/20">¡Cambios Guardados!</span>}</div>
                <div className="space-y-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Días Laborables</label>
                        <div className="flex gap-2 flex-wrap">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((day,idx)=><button key={idx} onClick={()=>{const n=shopConfig.workDays.includes(idx)?shopConfig.workDays.filter(d=>d!==idx):[...shopConfig.workDays,idx];setShopConfig({...shopConfig,workDays:n})}} className={`w-12 h-12 rounded-xl text-sm font-bold transition-all ${shopConfig.workDays.includes(idx)?'bg-orange-600 text-white shadow-lg shadow-orange-900/30 scale-110':'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{day.slice(0,3)}</button>)}</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre del Taller</label><input value={shopConfig.shopName} onChange={e=>setShopConfig({...shopConfig,shopName:e.target.value})} className="w-full bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Teléfono</label><input value={shopConfig.shopPhone} onChange={e=>setShopConfig({...shopConfig,shopPhone:e.target.value})} className="w-full bg-slate-950 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Dirección</label><input value={shopConfig.shopAddress} onChange={e=>setShopConfig({...shopConfig,shopAddress:e.target.value})} className="w-full bg-slate-950 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Logo del Taller</label><div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">{shopConfig.logoUrl && <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-black"><img src={shopConfig.logoUrl} className="w-full h-full object-cover"/><button onClick={()=>setShopConfig({...shopConfig, logoUrl: ''})} className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl hover:bg-red-700 transition"><Trash2 size={12}/></button></div>}<div className="flex-1"><label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 border border-slate-700"><Upload size={16}/> Subir Imagen <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload}/></label><p className="text-xs text-slate-500 mt-2">Recomendado: 200x200px. Máx 500KB.</p></div></div></div><div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Límite de Turnos por Día</label><div className="flex items-center gap-4"><input type="number" value={shopConfig.maxPerDay} onChange={e=>setShopConfig({...shopConfig,maxPerDay:parseInt(e.target.value)})} className="w-24 bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition text-center font-bold text-lg" /><span className="text-slate-500 text-sm">turnos permitidos por jornada.</span></div></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Inicio de Implementación</label><input type="date" value={shopConfig.implementationDate} onChange={e=>setShopConfig({...shopConfig,implementationDate:e.target.value})} className="w-full bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white [color-scheme:dark] outline-none focus:border-blue-500 transition" /></div></div>
                    <Button onClick={()=>saveConfig()} className="w-full py-4 text-lg mt-4 shadow-blue-900/30">Guardar Cambios</Button>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center gap-2"><CalendarX size={24} className="text-red-400"/> Gestión de Calendario</h3></div>
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6">
                    <p className="text-sm text-slate-400 mb-4">Bloquea fechas específicas (feriados, vacaciones) para que los clientes no puedan reservar.</p>
                    <div className="flex gap-4">
                        <input type="date" value={dateToBlock} onChange={e=>setDateToBlock(e.target.value)} className="bg-slate-950 border border-slate-800 text-white rounded-xl p-3 outline-none focus:border-red-500" />
                        <Button onClick={handleBlockDate} variant="danger" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30">Bloquear Fecha</Button>
                    </div>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Fechas Bloqueadas Activas</h4>
                    <div className="flex flex-wrap gap-3">
                        {(!shopConfig.blockedDates || shopConfig.blockedDates.length === 0) && <p className="text-sm text-slate-600 italic">No hay fechas bloqueadas.</p>}
                        {(shopConfig.blockedDates || []).map(date => (
                            <div key={date} className="bg-red-900/20 border border-red-500/30 text-red-300 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                                <CalendarX size={14}/>
                                {new Date(date).toLocaleDateString()}
                                <button onClick={()=>handleUnblockDate(date)} className="hover:text-white ml-1"><XCircle size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        </div>}
        
        {subView === 'stats' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2 flex justify-end gap-2 mb-2">
                <button onClick={() => setStatsPeriod('week')} className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statsPeriod === 'week' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>Semana</button>
                <button onClick={() => setStatsPeriod('month')} className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statsPeriod === 'month' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>Mes</button>
                <button onClick={() => setStatsPeriod('all')} className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statsPeriod === 'all' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>Histórico</button>
            </div>
            <Card><h3 className="text-white font-bold mb-6 flex items-center gap-2 text-lg"><BarChart3 size={24} className="text-blue-500"/> Reparaciones por Mecánico</h3><div className="space-y-6">{mechanics.filter(m=>!m.isAdmin).map(m=>{const count=getStatsAppointments().filter(a=>a.mechanicId===m.dni&&a.status==='listo').length; const active=appointments.filter(a=>a.mechanicId===m.dni&&a.status==='en-proceso').length; return <div key={m.id} className="bg-slate-900/50 p-3 rounded-xl border border-slate-800"><div className="flex justify-between items-center text-sm text-slate-300 mb-2 font-medium"><span>{m.name}</span><div className="flex gap-3"><span className="text-blue-400 text-xs bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/30">{active} Activas</span><span className="text-emerald-400 font-bold">{count} Finalizadas</span></div></div><div className="h-3 bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000" style={{width:`${Math.min((count/20)*100,100)}%`}}></div></div></div>})}</div></Card><Card><h3 className="text-white font-bold mb-6 flex items-center gap-2 text-lg"><Timer size={24} className="text-emerald-500"/> Eficiencia</h3><div className="flex flex-col items-center justify-center py-10"><div className="text-6xl font-bold text-white mb-2 tracking-tighter">{(() => { const finished = getStatsAppointments().filter(a => a.status === 'listo' && a.startedAt && a.finishedAt); if (!finished.length) return '0h'; const totalMs = finished.reduce((acc, curr) => acc + (new Date(curr.finishedAt) - new Date(curr.startedAt)), 0); const avgMs = totalMs / finished.length; const hrs = Math.floor(avgMs / 3600000); return `${hrs}h ${Math.round((avgMs % 3600000) / 60000)}m`; })()}</div><p className="text-slate-400 text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Tiempo promedio en taller</p></div></Card></div>}
    </main></div>
  );
}