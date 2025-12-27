import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, runTransaction, where, getDocs, setDoc } from 'firebase/firestore';
import { Calendar, Clock, Wrench, User, LogOut, CheckCircle, XCircle, AlertCircle, Bike, ClipboardList, Plus, Loader2, MessageCircle, Shield, Users, Lock, Sun, Moon, Search, Settings, BarChart3, Printer, FileText, Timer, Store, RotateCcw, Eye, EyeOff, Edit, History, Trash2, Image as ImageIcon, Upload, ArrowRight } from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE (REAL) ---
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

const appId = "mi-taller-bici";

// --- CONSTANTES ---
const SERVICE_TYPES = [
  "Mantenimiento General (Garantía 30 días)",
  "Mantenimiento General (Particular)",
  "Revisión 7 días (Ajuste)",
  "Armado de Bike",
  "Cambio de Cámara/Cubierta",
  "Lavado y Engrase"
];
const GENERIC_PASS = "Taller2025"; 

// --- HELPERS ---
const formatDateForQuery = (d) => d.toISOString().split('T')[0];
const formatDisplayDate = (d) => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return { dayName: days[d.getDay()], date: `${d.getDate()}/${d.getMonth()+1}` };
};
const calculateDuration = (start, end) => {
  if (!start || !end) return 'N/A';
  const diffMs = new Date(end) - new Date(start);
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.round(((diffMs % 3600000) / 60000));
  return `${hrs}h ${mins}m`;
};

// --- COMPONENTES UI ---
const Button = ({ children, onClick, variant = 'primary', className = '', disabled, ...props }) => {
  const variants = {
    primary: 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-900/20 disabled:bg-slate-700 disabled:text-slate-500',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 hover:border-slate-500',
    admin: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
    whatsapp: 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-white'
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl ${className} ${onClick ? 'cursor-pointer hover:border-slate-600 hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300' : ''}`}>
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
  const labels = { 'pendiente': 'Reservado', 'recibido': 'En Taller (Espera)', 'en-proceso': 'En Reparación', 'listo': 'Finalizado' };
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles['pendiente']}`}>{labels[status] || status}</span>;
};

// --- APP PRINCIPAL ---
export default function TurnosBikesApp() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Config
  const [shopConfig, setShopConfig] = useState({ workDays: [1, 3, 5], shopName: 'Turnos Bikes', shopAddress: 'Calle Falsa 123', shopPhone: '11 2233 4455', maxPerDay: 4, logoUrl: '', lastOrderNumber: 1000 });
  const [configSuccess, setConfigSuccess] = useState(false);

  // Nav & Auth
  const [view, setView] = useState('login'); 
  const [subView, setSubView] = useState('dashboard'); 
  const [isStaffLogin, setIsStaffLogin] = useState(false);
  const [loginStep, setLoginStep] = useState(1);
  const [loginDni, setLoginDni] = useState('');
  const [loginPassword, setLoginPassword] = useState(''); 
  const [loginError, setLoginError] = useState('');
  const [loginForm, setLoginForm] = useState({ name: '', phone: '', bikeModel: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Force Change Password
  const [tempStaffId, setTempStaffId] = useState(null);
  const [newPasswordForm, setNewPasswordForm] = useState({ new: '', confirm: '' });

  // Forms
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeBlock, setSelectedTimeBlock] = useState(null);
  const [apptNotes, setApptNotes] = useState('');
  const [clientBikeModel, setClientBikeModel] = useState('');
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  
  const [adminFormData, setAdminFormData] = useState({ bikeModel: '', phone: '', date: '', serviceType: SERVICE_TYPES[0] });
  const [showAdminApptModal, setShowAdminApptModal] = useState(false);
  
  // Modals
  const [editingClient, setEditingClient] = useState(null); 
  const [receptionModal, setReceptionModal] = useState(null); 
  const [confirmModal, setConfirmModal] = useState(null);

  // Filters & Staff Form
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [newMechDni, setNewMechDni] = useState('');
  const [newMechName, setNewMechName] = useState('');
  const [newMechPassword, setNewMechPassword] = useState(GENERIC_PASS);
  const [newMechIsAdmin, setNewMechIsAdmin] = useState(false);

  // Init
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
        // Intentar fallback si falla el token custom
        try { await signInAnonymously(auth); } catch (e) {
             if (isMounted) {
                setAuthError(`No se pudo conectar con la base de datos. (${err.code || e.code})`);
                setLoading(false);
            }
        }
      }
    };
    
    if (auth) {
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
            console.error("Auth Listener Error", err);
            if (isMounted) {
                 setAuthError("Error de sesión: " + err.message);
                 setLoading(false);
            }
        });
        return () => { isMounted = false; unsubscribe(); };
    } else {
        setAuthError("Firebase no se inicializó correctamente.");
        setLoading(false);
    }
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

  const saveConfig = async () => {
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), shopConfig, { merge: true });
          setConfigSuccess(true); setTimeout(() => setConfigSuccess(false), 3000); 
      } catch (e) { alert("Error al guardar: " + e.message); }
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
    if (!user) return alert("Error: No estás conectado al sistema. Recarga la página.");
    if (!selectedDate || !selectedTimeBlock) return alert("Falta fecha/hora");
    if (appointments.filter(a => a.clientId === user.uid && ['pendiente','recibido','en-proceso'].includes(a.status)).length >= 3) return alert("Máximo 3 turnos activos.");
    
    const d = new Date(selectedDate);
    if (selectedTimeBlock === 'morning') d.setHours(9); else d.setHours(18);
    
    try {
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
    }
  };

  const createAdminAppointment = async (e) => {
    e.preventDefault();
    if (!user) return alert("Error: Sin conexión a base de datos.");
    if (!adminFormData.date || !adminFormData.phone || !adminFormData.bikeModel) return alert("Faltan datos");
    try {
        const d = new Date(adminFormData.date);
        const orderNum = await generateOrderNumber();
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'turnos'), {
            orderId: orderNum, clientId: 'admin-created', clientName: 'Cliente (Mostrador)', clientDni: 'N/A',
            clientPhone: adminFormData.phone, bikeModel: adminFormData.bikeModel, serviceType: adminFormData.serviceType,
            date: d.toISOString(), dateString: formatDateForQuery(d), notes: 'Agendado por Staff', status: 'pendiente', createdBy: 'mechanic', createdAt: new Date().toISOString()
        });
        alert(`Turno #${orderNum} creado.`); setShowAdminApptModal(false); setAdminFormData({ bikeModel: '', phone: '', date: '', serviceType: SERVICE_TYPES[0] });
    } catch (e) { alert("Error al crear: " + e.message); }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!loginDni || !loginPassword) return setLoginError("Faltan datos");
    setLoading(true);
    
    // Bootstrap logic
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
      if (newStatus === 'recibido') data.arrivedAt = new Date().toISOString();
      if (newStatus === 'en-proceso') { data.startedAt = new Date().toISOString(); data.mechanicName = appUser.name; data.mechanicId = appUser.dni; }
      if (newStatus === 'listo') data.finishedAt = new Date().toISOString();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'turnos', id), data);
  };

  const handleReceptionConfirm = async (e) => {
      e.preventDefault();
      const { id, ...curr } = receptionModal.appt;
      const updates = { bikeModel: receptionModal.bikeModel, serviceType: receptionModal.serviceType, notes: receptionModal.notes };
      await updateStatus(id, 'recibido', updates);
      printServiceOrder({ ...curr, ...updates, id, orderId: receptionModal.appt.orderId });
      setReceptionModal(null);
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

  const triggerResetPassword = (id, name) => {
      setConfirmModal({
          title: '¿Restablecer Contraseña?',
          msg: `La clave de ${name} volverá a ser "${GENERIC_PASS}" y se le pedirá cambiarla al ingresar.`,
          action: async () => {
              try { 
                  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mechanics', id), { password: GENERIC_PASS, forcePasswordChange: true }); 
                  alert("Contraseña restablecida."); 
              } catch (err) { console.error(err); alert("Error: " + err.message); }
              setConfirmModal(null);
          }
      });
  };

  const triggerRemoveMechanic = (id, name) => {
      setConfirmModal({
          title: 'Eliminar Usuario',
          msg: `¿Estás seguro de eliminar a ${name}? Esta acción es irreversible.`,
          action: async () => {
              try {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mechanics', id));
                alert("Usuario eliminado.");
              } catch(e) { console.error(e); alert("Error al eliminar: " + e.message); }
              setConfirmModal(null);
          }
      });
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

  // --- PRINTING ---
  const printServiceOrder = (appt) => {
    const logoHtml = shopConfig.logoUrl ? `<img src="${shopConfig.logoUrl}" style="max-height:80px;display:block;margin:0 auto 10px"/>` : '';
    const win = window.open('','','width=800,height=800');
    win.document.write(`<html><head><title>Orden #${appt.orderId}</title><style>body{font-family:monospace;padding:20px;max-width:600px;margin:0 auto;border:1px solid #ccc}.header{text-align:center;border-bottom:2px dashed #000;padding-bottom:15px;margin-bottom:20px}.row{display:flex;justify-content:space-between;margin-bottom:8px}.title{font-weight:bold;font-size:1.2em;margin-top:20px}.footer{margin-top:40px;text-align:center;font-size:0.8em;border-top:1px solid #000;padding-top:10px}</style></head><body><div class="header">${logoHtml}<h1>${shopConfig.shopName}</h1><p>${shopConfig.shopAddress} - Tel: ${shopConfig.shopPhone}</p><h2>ORDEN #${appt.orderId || appt.id.slice(0,6).toUpperCase()}</h2></div><div class="title">CLIENTE</div><div class="row"><span>Nombre:</span><strong>${appt.clientName}</strong></div><div class="row"><span>DNI:</span><span>${appt.clientDni}</span></div><div class="row"><span>Tel:</span><span>${appt.clientPhone}</span></div><div class="title">SERVICIO</div><div class="row"><span>Modelo:</span><strong>${appt.bikeModel}</strong></div><div class="row"><span>Servicio:</span><span>${appt.serviceType}</span></div><div class="row"><span>Notas:</span><span>${appt.notes||'-'}</span></div><div class="footer"><p>Acepto términos y condiciones.</p><br/><div style="display:flex;justify-content:space-between;margin-top:30px"><span>Firma Cliente</span><span>Firma Taller</span></div></div></body></html>`);
    win.document.close(); win.print();
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

  const renderDateSelector = () => {
    const dates = []; let d = new Date(); d.setDate(d.getDate()+1);
    let loops = 0;
    while (dates.length < 6 && loops < 60) { 
        if(shopConfig.workDays.includes(d.getDay())) dates.push(new Date(d)); 
        d.setDate(d.getDate()+1);
        loops++;
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {dates.map((d,i) => {
            const ds = formatDateForQuery(d);
            const count = appointments.filter(a=>a.dateString===ds && a.status!=='cancelado').length;
            const full = count >= shopConfig.maxPerDay;
            const sel = selectedDate && formatDateForQuery(selectedDate) === ds;
            return <button key={i} onClick={()=>!full && setSelectedDate(d)} disabled={full} className={`p-3 rounded-xl border text-left transition-all ${full?'bg-slate-800/50 border-slate-700 opacity-50 cursor-not-allowed':sel?'bg-orange-600 border-orange-500 ring-2 ring-orange-500/30 shadow-lg':'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}><div className="flex justify-between items-start mb-1"><span className={`text-sm font-bold ${full?'text-slate-500':'text-white'}`}>{formatDisplayDate(d).dayName}</span>{full?<XCircle size={14} className="text-red-500"/>:<CheckCircle size={14} className="text-emerald-500"/>}</div><div className="text-xs text-slate-300">{formatDisplayDate(d).date}</div><div className={`mt-2 text-xs font-semibold ${full?'text-red-400':'text-emerald-400'}`}>{full?'Agotado':`${shopConfig.maxPerDay-count} libres`}</div></button>
        })}
      </div>
    );
  };

  const sendWhatsApp = (phone, name, bike, status) => {
    if (!phone) { alert("Sin teléfono."); return; }
    let msg = `Hola ${name}, mensaje de ${shopConfig.shopName} sobre tu ${bike}.`;
    if (status === 'listo') msg = `Hola ${name}, tu ${bike} está lista para retirar en ${shopConfig.shopName}.`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const printList = () => {
    const list = getFilteredAppointments();
    const content = `<html><head><title>Reporte</title><style>table{width:100%;border-collapse:collapse;font-family:sans-serif}th,td{border:1px solid #ddd;padding:8px}th{background-color:#f2f2f2}</style></head><body><h1>Reporte Turnos</h1><table><thead><tr><th>Orden</th><th>Fecha</th><th>Cliente</th><th>Bici</th><th>Servicio</th><th>Estado</th></tr></thead><tbody>${list.map(a=>`<tr><td>${a.orderId ? '#'+a.orderId : a.id.slice(0,6)}</td><td>${new Date(a.date).toLocaleDateString()}</td><td>${a.clientName}</td><td>${a.bikeModel}</td><td>${a.serviceType}</td><td>${a.status}</td></tr>`).join('')}</tbody></table></body></html>`;
    const win = window.open('','','width=900,height=600'); win.document.write(content); win.document.close(); win.print();
  };

  if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-orange-500 gap-2"><Loader2 className="animate-spin"/> Cargando...</div>;

  // --- VIEWS ---
  if (authError) return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
        <AlertCircle size={48} className="text-red-500 mb-4"/>
        <h2 className="text-xl font-bold mb-2">Error de Sistema</h2>
        <p className="text-slate-400 text-center">{authError}</p>
        <p className="text-xs text-slate-600 mt-4 text-center">Verifica que "localhost" o tu dominio de Vercel estén en Firebase Auth &gt; Settings &gt; Authorized Domains.</p>
    </div>
  );

  if (view === 'force-change-password') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4"><div className="max-w-md w-full"><div className="text-center mb-8"><div className="w-20 h-20 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce shadow-xl shadow-orange-900/40"><Lock size={36} className="text-white"/></div><h1 className="text-2xl font-bold text-white">Cambio Obligatorio</h1><p className="text-slate-400 mt-2">Por seguridad, actualiza tu contraseña temporal.</p></div><Card className="border-orange-500/30"><form onSubmit={handleChangePassword} className="space-y-4"><input type="password" required className="w-full bg-slate-900/50 text-white rounded-lg p-3 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" value={newPasswordForm.new} onChange={e=>setNewPasswordForm({...newPasswordForm,new:e.target.value})} placeholder="Nueva Clave" /><input type="password" required className="w-full bg-slate-900/50 text-white rounded-lg p-3 border border-slate-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" value={newPasswordForm.confirm} onChange={e=>setNewPasswordForm({...newPasswordForm,confirm:e.target.value})} placeholder="Confirmar" /><Button type="submit" className="w-full mt-4 py-3">Actualizar Clave</Button></form></Card></div></div>
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
                <input value={loginForm.bikeModel} onChange={e=>setLoginForm({...loginForm,bikeModel:e.target.value})} className="w-full bg-slate-900/50 border-slate-700 border rounded-xl p-3.5 text-white focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Modelo de tu Bici (Opcional)" />
                <Button type="submit" className="w-full py-3.5 mt-2">Registrarme</Button>
            </form>
        )}
        <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-center"><button onClick={()=>{setIsStaffLogin(!isStaffLogin);setLoginStep(1);setLoginDni('');setLoginPassword('');}} className="text-sm flex items-center gap-2 text-slate-500 hover:text-white transition-colors py-2 px-4 rounded-lg hover:bg-slate-800">{isStaffLogin?<>Volver al Acceso de Clientes</>:<><Lock size={14}/> Soy Personal del Taller</>}</button></div>
    </Card></div></div>
  );

  const Header = () => (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 transition-all"><div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`p-2 rounded-xl w-10 h-10 flex items-center justify-center overflow-hidden shadow-lg ${appUser.role==='mechanic'?'bg-gradient-to-br from-blue-600 to-blue-700':'bg-gradient-to-br from-orange-600 to-orange-700'}`}>{shopConfig.logoUrl?<img src={shopConfig.logoUrl} className="w-full h-full object-cover"/>:<Bike size={24} className="text-white"/>}</div><div><h1 className="text-lg font-bold text-white leading-tight tracking-tight">{shopConfig.shopName}</h1><p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{appUser.role==='client'?'Cliente':(appUser.isAdmin?'Admin':'Mecánico')}</p></div></div><div className="flex items-center gap-4"><div className="hidden sm:block text-right"><p className="text-sm text-white font-medium">{appUser.name}</p><p className="text-xs text-slate-500">{appUser.dni}</p></div><Button variant="ghost" onClick={handleLogout} className="text-slate-400 hover:text-white hover:bg-slate-800"><LogOut size={20}/></Button></div></div></header>
  );

  if (view === 'client-dashboard') return (
    <div className="min-h-screen bg-slate-950 pb-20"><Header /><main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2"><h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><span className="bg-orange-600/20 text-orange-500 p-2 rounded-lg"><Plus size={24}/></span> Reservar Nuevo Turno</h2><Card><div className="mb-8"><h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">1. Selecciona un Día</h3>{renderDateSelector()}</div>{selectedDate && <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500"><h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">2. Elige Horario</h3><div className="grid grid-cols-2 gap-4"><button onClick={()=>setSelectedTimeBlock('morning')} className={`p-5 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-300 ${selectedTimeBlock==='morning'?'bg-orange-600 border-orange-500 text-white shadow-orange-900/20 shadow-xl scale-[1.02]':'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'}`}><Sun size={28}/><span>Mañana</span><span className="text-xs opacity-60 font-mono bg-black/20 px-2 py-0.5 rounded">08:00 - 10:00</span></button><button onClick={()=>setSelectedTimeBlock('afternoon')} className={`p-5 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-300 ${selectedTimeBlock==='afternoon'?'bg-orange-600 border-orange-500 text-white shadow-orange-900/20 shadow-xl scale-[1.02]':'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:border-slate-600'}`}><Moon size={28}/><span>Tarde</span><span className="text-xs opacity-60 font-mono bg-black/20 px-2 py-0.5 rounded">17:30 - 19:00</span></button></div></div>}{selectedDate && selectedTimeBlock && <div className="animate-in fade-in slide-in-from-top-4 duration-500"><h3 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">3. Confirmar Reserva</h3><div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800 mb-6"><div className="space-y-1"><label className="text-xs text-slate-400 font-semibold uppercase">Tu Bici (Puedes editarla):</label><input value={clientBikeModel} onChange={e=>setClientBikeModel(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none transition" placeholder="Ej: SLP 29 Pro" /></div><div className="space-y-1"><label className="text-xs text-slate-400 font-semibold uppercase">Servicio:</label><select value={serviceType} onChange={e=>setServiceType(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none">{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div className="space-y-1"><label className="text-xs text-slate-400 font-semibold uppercase">Notas Adicionales:</label><textarea value={apptNotes} onChange={e=>setApptNotes(e.target.value)} rows="2" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none" placeholder="¿Algún ruido raro? ¿Detalle específico?"/></div></div><Button onClick={createClientAppointment} className="w-full py-4 text-lg shadow-orange-900/40">Confirmar Reserva</Button></div>}</Card></div>
        <div className="lg:col-span-1 space-y-6"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3"><span className="bg-slate-800 text-slate-400 p-2 rounded-lg"><ClipboardList size={24}/></span> Mis Turnos</h2>{appointments.filter(a=>a.clientDni===appUser.dni).length===0?<div className="text-center py-16 bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-800"><Bike className="mx-auto text-slate-700 mb-4" size={64}/><p className="text-slate-500 font-medium">No tienes turnos activos.</p></div>:appointments.filter(a=>a.clientDni===appUser.dni).map(appt=><Card key={appt.id} className="relative group overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Bike size={80}/></div><div className="flex flex-col gap-3 relative z-10"><div className="flex justify-between items-center mb-1"><Badge status={appt.status}/><span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">#{appt.orderId}</span></div><div><h3 className="text-lg font-bold text-white leading-tight">{appt.serviceType}</h3><p className="text-slate-400 text-sm mt-1">{appt.bikeModel}</p></div><div className="flex items-center gap-3 mt-2 bg-slate-900/60 p-3 rounded-xl text-sm text-slate-300 border border-slate-800"><Calendar size={16} className="text-orange-500"/><div className="flex flex-col leading-none"><span className="text-xs text-slate-500 font-bold uppercase">Fecha</span><span>{new Date(appt.date).toLocaleDateString()} • {appt.timeBlock==='morning'?'Mañana':'Tarde'}</span></div></div></div></Card>)}</div>
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
    <main className="max-w-7xl mx-auto px-4 py-8">
        {confirmModal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"><Card className="w-full max-w-sm border-red-500/30 bg-slate-900 shadow-2xl"><div className="flex justify-center mb-4 text-red-500"><AlertCircle size={48} /></div><h3 className="text-xl font-bold text-white mb-2 text-center">{confirmModal.title}</h3><p className="text-slate-400 mb-6 text-center text-sm">{confirmModal.msg}</p><div className="flex gap-3"><Button variant="secondary" onClick={()=>setConfirmModal(null)} className="flex-1 py-3">Cancelar</Button><Button variant="danger" onClick={()=>{confirmModal.action();}} className="flex-1 py-3">Confirmar Acción</Button></div></Card></div>}
        
        {showAdminApptModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"><Card className="w-full max-w-lg relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setShowAdminApptModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Plus className="text-blue-500"/> Nuevo Turno Manual</h3><form onSubmit={createAdminAppointment} className="space-y-5"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bicicleta</label><input value={adminFormData.bikeModel} onChange={e=>setAdminFormData({...adminFormData, bikeModel:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" placeholder="Ej: SLP 29 Pro" /></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono Cliente</label><input value={adminFormData.phone} onChange={e=>setAdminFormData({...adminFormData, phone:e.target.value})} type="tel" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" placeholder="WhatsApp" /></div><div className="grid grid-cols-2 gap-4"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</label><input type="datetime-local" value={adminFormData.date} onChange={e=>setAdminFormData({...adminFormData, date:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white [color-scheme:dark] outline-none focus:border-blue-500 transition" /></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Servicio</label><select value={adminFormData.serviceType} onChange={e=>setAdminFormData({...adminFormData, serviceType:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition">{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div></div><Button type="submit" variant="admin" className="w-full py-4 text-lg mt-4">Guardar Turno</Button></form></Card></div>}

        {subView === 'dashboard' && <>
            {receptionModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"><Card className="w-full max-w-lg relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setReceptionModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-2xl font-bold text-white mb-2">Recepción de Bicicleta</h3><div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl mb-6 flex items-center gap-3"><User className="text-blue-400"/><div className="text-sm"><p className="text-blue-200 font-bold">{receptionModal.appt.clientName}</p><p className="text-blue-400/60">DNI: {receptionModal.appt.clientDni}</p></div></div><form onSubmit={handleReceptionConfirm} className="space-y-5"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo Bici (Verificar)</label><input value={receptionModal.bikeModel} onChange={e=>setReceptionModal({...receptionModal, bikeModel:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition"/></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Servicio a Realizar</label><select value={receptionModal.serviceType} onChange={e=>setReceptionModal({...receptionModal, serviceType:e.target.value})} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition">{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notas / Diagnóstico Visual</label><textarea value={receptionModal.notes} onChange={e=>setReceptionModal({...receptionModal, notes:e.target.value})} rows="3" className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition resize-none" placeholder="Rayones, estado general..."/></div><Button type="submit" className="w-full py-4 text-lg mt-2">Confirmar e Imprimir Orden</Button></form></Card></div>}
            
            <div className="mb-8 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-4 shadow-inner"><div className="md:col-span-4 relative"><Search className="absolute left-4 top-3.5 text-slate-500" size={20}/><input placeholder="Buscar ID, Cliente, Bici..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl pl-12 p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"/></div><div className="md:col-span-3"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 cursor-pointer"><option value="all">Todos los Estados</option><option value="pendiente">Pendientes</option><option value="recibido">En Espera (Taller)</option><option value="en-proceso">En Reparación</option><option value="listo">Terminados</option></select></div><div className="md:col-span-3"><input type="date" value={dateFilterStart} onChange={e=>setDateFilterStart(e.target.value)} className="w-full bg-slate-950 border-slate-800 border rounded-xl p-3 text-white [color-scheme:dark] focus:outline-none focus:border-blue-500 cursor-pointer"/></div><div className="md:col-span-2"><Button variant="secondary" onClick={printList} className="w-full h-full flex gap-2 items-center justify-center bg-slate-800 border-slate-700 hover:bg-slate-700"><Printer size={18}/> Reporte</Button></div></div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                <div className="group h-full">
                    <Card onClick={()=>setShowAdminApptModal(true)} className="h-full border-2 border-dashed border-slate-700 bg-slate-800/30 hover:bg-slate-800/80 hover:border-blue-500/50 flex flex-col justify-center items-center gap-4 transition-all duration-300 group">
                        <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-300 shadow-xl"><Plus size={40} className="text-slate-600 group-hover:text-white transition-colors"/></div>
                        <div className="text-center"><h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">Nuevo Turno</h3><p className="text-slate-500 text-sm">Agendar Manualmente</p></div>
                    </Card>
                </div>
                {filteredAppts.map(appt=><Card key={appt.id} className={`flex flex-col relative overflow-hidden ${appt.status==='listo'?'border-emerald-500/30 bg-emerald-900/5':''}`}><div className={`absolute top-0 left-0 w-1 h-full ${appt.status==='listo'?'bg-emerald-500':appt.status==='en-proceso'?'bg-blue-500':appt.status==='recibido'?'bg-amber-500':'bg-slate-600'}`}></div><div className="pl-3"><div className="flex justify-between items-start mb-3"><div><h3 className="text-white font-bold text-lg leading-tight line-clamp-1" title={appt.bikeModel}>{appt.bikeModel}</h3><div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1.5 font-medium"><User size={12} className="text-slate-500"/> {appt.clientName}</div><div className="text-[10px] text-slate-500 mt-1 font-mono bg-slate-900/50 w-fit px-1.5 py-0.5 rounded">ID: #{appt.orderId || appt.id.slice(0,4)}</div></div><Badge status={appt.status}/></div><div className="flex-grow space-y-3 mb-5"><div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/50"><p className="text-blue-400 text-xs font-bold uppercase tracking-wide mb-1">Servicio</p><p className="text-slate-300 text-sm font-medium line-clamp-2">{appt.serviceType}</p></div><div className="flex flex-wrap gap-2 text-xs text-slate-400"><span className="bg-slate-950 px-2.5 py-1.5 rounded-md border border-slate-800 flex items-center gap-1.5"><Calendar size={12} className="text-slate-500"/> {new Date(appt.date).toLocaleDateString()}</span></div>{appt.mechanicName && <div className="text-xs text-slate-300 flex items-center gap-1.5 bg-blue-900/10 px-2 py-1 rounded border border-blue-900/20 w-fit"><Wrench size={10} className="text-blue-400"/> {appt.mechanicName}</div>}</div><div className="border-t border-slate-700/50 pt-4 grid gap-2">{appt.status==='pendiente' && <Button variant="secondary" className="text-xs w-full py-2.5 bg-slate-800 hover:bg-slate-700 border-slate-700" onClick={()=>setReceptionModal({appt, bikeModel:appt.bikeModel, serviceType:appt.serviceType, notes:appt.notes||''})}><FileText size={14}/> Recepcionar & Imprimir</Button>}{appt.status==='recibido' && <Button variant="admin" className="text-xs w-full py-2.5" onClick={()=>updateStatus(appt.id,'en-proceso')}><Wrench size={14}/> Iniciar Reparación</Button>}{appt.status==='en-proceso' && <Button variant="success" className="text-xs w-full py-2.5" onClick={()=>updateStatus(appt.id,'listo')}><CheckCircle size={14}/> Finalizar Trabajo</Button>}{appt.status==='listo' && <Button variant="whatsapp" className="text-xs w-full py-2.5" onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)}><MessageCircle size={14}/> Avisar Retiro</Button>}<div className="flex justify-between pt-2 mt-1"><button onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)} className="p-2 rounded-lg bg-slate-800 hover:bg-green-500/20 text-slate-400 hover:text-green-500 transition-colors border border-slate-700 hover:border-green-500/30" title="WhatsApp"><MessageCircle size={16}/></button>{appt.status!=='pendiente'&&<button onClick={()=>printServiceOrder(appt)} className="p-2 rounded-lg bg-slate-800 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors border border-slate-700 hover:border-blue-500/30" title="Reimprimir"><Printer size={16}/></button>}<button onClick={()=>updateStatus(appt.id,'pendiente')} className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors border border-slate-700 hover:border-red-500/30" title="Resetear"><RotateCcw size={16}/></button></div></div></div></Card>)}</div>
        </>}

        {subView === 'clients' && appUser.isAdmin && <div className="space-y-6">
            {editingClient && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"><Card className="w-full max-w-md relative bg-slate-900 border-slate-700 shadow-2xl"><button onClick={()=>setEditingClient(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><XCircle/></button><h3 className="text-2xl font-bold text-white mb-6">Editar Cliente</h3><form onSubmit={handleUpdateClient} className="space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre</label><input value={editingClient.name} onChange={e=>setEditingClient({...editingClient,name:e.target.value})} className="w-full bg-slate-950 text-white rounded-xl p-3 border border-slate-800 focus:border-blue-500 outline-none transition"/></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono</label><input value={editingClient.phone} onChange={e=>setEditingClient({...editingClient,phone:e.target.value})} className="w-full bg-slate-950 text-white rounded-xl p-3 border border-slate-800 focus:border-blue-500 outline-none transition"/></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bici (Default)</label><input value={editingClient.bikeModel} onChange={e=>setEditingClient({...editingClient,bikeModel:e.target.value})} className="w-full bg-slate-950 text-white rounded-xl p-3 border border-slate-800 focus:border-blue-500 outline-none transition"/></div><Button type="submit" className="w-full py-3 mt-2">Guardar Cambios</Button></form></Card></div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{clients.map(client=>{
                const clientServices=appointments.filter(a=>a.clientDni===client.dni&&a.status==='listo');
                const lastServiceDate=clientServices.length>0?new Date(Math.max(...clientServices.map(a=>new Date(a.date)))):null;
                return <Card key={client.id} className="relative group hover:border-slate-600 transition"><div className="flex items-start justify-between mb-4"><div className="flex items-center gap-3"><div className="bg-slate-800 p-3 rounded-full border border-slate-700 shadow-inner"><User size={24} className="text-slate-300"/></div><div><h3 className="font-bold text-white text-lg">{client.name}</h3><p className="text-xs text-slate-500 font-mono bg-slate-900 px-1.5 py-0.5 rounded w-fit">DNI: {client.dni}</p></div></div><button onClick={()=>setEditingClient(client)} className="text-slate-600 hover:text-blue-400 p-2 rounded-lg hover:bg-blue-500/10 transition"><Edit size={18}/></button></div>
                <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center"><div className="text-slate-500 mb-1 flex items-center justify-center gap-1 font-bold uppercase tracking-wider"><Wrench size={12}/> Servicios</div><div className="text-xl font-bold text-blue-400">{clientServices.length}</div></div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center"><div className="text-slate-500 mb-1 flex items-center justify-center gap-1 font-bold uppercase tracking-wider"><History size={12}/> Último</div><div className="text-sm font-medium text-slate-300">{lastServiceDate ? lastServiceDate.toLocaleDateString() : '-'}</div></div>
                </div>
                <div className="mt-4"><button onClick={()=>sendWhatsApp(client.phone,client.name,client.bikeModel||'bici','consulta')} className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-green-600 hover:text-white text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700 hover:border-green-500 shadow-sm"><MessageCircle size={16}/> Contactar WhatsApp</button></div></Card>;
            })}</div></div>}

        {subView === 'mechanics-mgmt' && appUser.isAdmin && <div className="max-w-3xl mx-auto"><Card className="mb-8 border-blue-500/30 shadow-blue-900/10"><div className="flex items-center gap-3 mb-6"><div className="bg-blue-500/20 p-3 rounded-full"><Shield size={24} className="text-blue-400"/></div><h3 className="text-2xl font-bold text-white">Gestión de Staff</h3></div><form onSubmit={addMechanic} className="grid grid-cols-1 md:grid-cols-3 gap-5 bg-slate-900/50 p-5 rounded-2xl border border-slate-800 mb-4"><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</label><input required value={newMechName} onChange={e=>setNewMechName(e.target.value)} className="w-full bg-slate-950 text-white rounded-xl p-3 text-sm border border-slate-800 focus:border-blue-500 outline-none" placeholder="Nombre"/></div><div className="space-y-1"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">DNI (Usuario)</label><input required value={newMechDni} onChange={e=>setNewMechDni(e.target.value)} type="number" className="w-full bg-slate-950 text-white rounded-xl p-3 text-sm border border-slate-800 focus:border-blue-500 outline-none" placeholder="DNI"/></div><div className="space-y-1 relative"><label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Contraseña</label><input required value={newMechPassword} onChange={e=>setNewMechPassword(e.target.value)} type="text" className="w-full bg-slate-950 text-white rounded-xl p-3 text-sm border border-slate-800 focus:border-blue-500 outline-none" /><div className="absolute top-8 right-3 text-xs text-slate-600 select-none">Default</div></div><div className="md:col-span-3 flex items-center justify-between pt-2"><div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"><input type="checkbox" checked={newMechIsAdmin} onChange={e=>setNewMechIsAdmin(e.target.checked)} className="rounded border-slate-700 bg-slate-800 text-blue-600 w-4 h-4"/><label className="text-sm text-slate-300 font-medium">¿Permisos de Admin?</label></div><Button type="submit" variant="admin" className="px-8"><Plus size={18}/> Crear Usuario</Button></div></form></Card><div className="space-y-3">{mechanics.map(m=><div key={m.id} className="flex justify-between items-center bg-slate-800/80 backdrop-blur-sm p-4 rounded-xl border border-slate-700 hover:border-slate-600 transition"><div className="flex items-center gap-4"><div className={`p-3 rounded-full ${m.isAdmin?'bg-blue-500/20 text-blue-400':'bg-slate-700 text-slate-400'}`}>{m.isAdmin?<Shield size={20}/>:<Wrench size={20}/>}</div><div><p className="text-white font-bold flex items-center gap-2 text-lg">{m.name}{m.isAdmin && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider font-bold">Admin</span>}</p><p className="text-sm text-slate-500 font-mono">DNI: {m.dni}</p></div></div><div className="flex gap-2"><Button variant="secondary" className="p-2.5 h-auto rounded-lg bg-slate-900 border-slate-800 hover:bg-slate-800" onClick={()=>triggerResetPassword(m.id, m.name)} title={`Resetear a ${GENERIC_PASS}`}><RotateCcw size={16}/></Button><Button variant="danger" className="p-2.5 h-auto rounded-lg" onClick={()=>triggerRemoveMechanic(m.id, m.name)}><Trash2 size={16}/></Button></div></div>)}</div></div>}
        
        {subView === 'config' && <div className="max-w-2xl mx-auto"><Card><div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings size={24} className="text-slate-400"/> Configuración del Taller</h3>{configSuccess && <span className="text-emerald-400 text-sm font-bold animate-in fade-in bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-500/20">¡Cambios Guardados!</span>}</div><div className="space-y-8"><div><label className="block text-sm font-bold text-slate-500 mb-3 uppercase tracking-wider">Días Laborables</label><div className="flex gap-2 flex-wrap">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((day,idx)=><button key={idx} onClick={()=>{const n=shopConfig.workDays.includes(idx)?shopConfig.workDays.filter(d=>d!==idx):[...shopConfig.workDays,idx];setShopConfig({...shopConfig,workDays:n})}} className={`w-12 h-12 rounded-xl text-sm font-bold transition-all ${shopConfig.workDays.includes(idx)?'bg-orange-600 text-white shadow-lg shadow-orange-900/30 scale-110':'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>{day.slice(0,3)}</button>)}</div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Nombre del Taller</label><input value={shopConfig.shopName} onChange={e=>setShopConfig({...shopConfig,shopName:e.target.value})} className="w-full bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div><div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Teléfono</label><input value={shopConfig.shopPhone} onChange={e=>setShopConfig({...shopConfig,shopPhone:e.target.value})} className="w-full bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Dirección</label><input value={shopConfig.shopAddress} onChange={e=>setShopConfig({...shopConfig,shopAddress:e.target.value})} className="w-full bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Logo del Taller</label><div className="flex items-center gap-4 bg-slate-900 p-4 rounded-xl border border-slate-800">{shopConfig.logoUrl && <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700 bg-black"><img src={shopConfig.logoUrl} className="w-full h-full object-cover"/><button onClick={()=>setShopConfig({...shopConfig, logoUrl: ''})} className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl hover:bg-red-700 transition"><Trash2 size={12}/></button></div>}<div className="flex-1"><label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition inline-flex items-center gap-2 border border-slate-700"><Upload size={16}/> Subir Imagen <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload}/></label><p className="text-xs text-slate-500 mt-2">Recomendado: 200x200px. Máx 500KB.</p></div></div></div><div><label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Max Turnos x Día</label><input type="number" value={shopConfig.maxPerDay} onChange={e=>setShopConfig({...shopConfig,maxPerDay:parseInt(e.target.value)})} className="w-full bg-slate-900 border-slate-800 rounded-xl p-3.5 text-white outline-none focus:border-blue-500 transition" /></div></div><Button onClick={saveConfig} className="w-full py-4 text-lg mt-4 shadow-blue-900/30">Guardar Cambios</Button></div></Card></div>}
        
        {subView === 'stats' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card><h3 className="text-white font-bold mb-6 flex items-center gap-2 text-lg"><BarChart3 size={24} className="text-blue-500"/> Reparaciones por Mecánico</h3><div className="space-y-6">{mechanics.filter(m=>!m.isAdmin).map(m=>{const count=appointments.filter(a=>a.mechanicId===m.dni&&a.status==='listo').length;return <div key={m.id}><div className="flex justify-between text-sm text-slate-300 mb-2 font-medium"><span>{m.name}</span><span className="text-white">{count}</span></div><div className="h-3 bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-1000" style={{width:`${Math.min((count/20)*100,100)}%`}}></div></div></div>})}</div></Card><Card><h3 className="text-white font-bold mb-6 flex items-center gap-2 text-lg"><Timer size={24} className="text-emerald-500"/> Eficiencia</h3><div className="flex flex-col items-center justify-center py-10"><div className="text-6xl font-bold text-white mb-2 tracking-tighter">{(() => { const finished = appointments.filter(a => a.status === 'listo' && a.startedAt && a.finishedAt); if (!finished.length) return '0h'; const totalMs = finished.reduce((acc, curr) => acc + (new Date(curr.finishedAt) - new Date(curr.startedAt)), 0); const avgMs = totalMs / finished.length; const hrs = Math.floor(avgMs / 3600000); return `${hrs}h ${Math.round((avgMs % 3600000) / 60000)}m`; })()}</div><p className="text-slate-400 text-sm bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Tiempo promedio en taller</p></div></Card></div>}
    </main></div>
  );
}