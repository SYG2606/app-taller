import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, doc, updateDoc, deleteDoc, runTransaction, where, getDocs } from 'firebase/firestore';
import { Calendar, Clock, Wrench, User, LogOut, CheckCircle, XCircle, AlertCircle, Bike, ClipboardList, Plus, Loader2, MessageCircle, Shield, Users, Lock, Sun, Moon, Search, Settings, BarChart3, Printer, FileText, Timer, Store, RotateCcw, Eye, EyeOff, Edit, History, Trash2, Image as ImageIcon, Upload } from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE ---
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5BVLXg7XUYm_B6cyv3hRIoYow1W0wWYg",
  authDomain: "turnos-bikes-app-98635.firebaseapp.com",
  projectId: "turnos-bikes-app-98635",
  storageBucket: "turnos-bikes-app-98635.firebasestorage.app",
  messagingSenderId: "93838557270",
  appId: "mi-taller-bici",
};

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
    secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
    admin: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20',
    danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
    success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20',
    whatsapp: 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20',
    ghost: 'hover:bg-slate-800 text-slate-400 hover:text-white'
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-xl ${className} ${onClick ? 'cursor-pointer hover:border-slate-600 transition' : ''}`}>
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
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles['pendiente']}`}>{labels[status] || status}</span>;
};

// --- APP PRINCIPAL ---
export default function TurnosBikesApp() {
  const [user, setUser] = useState(null);
  const [appUser, setAppUser] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
      else await signInAnonymously(auth);
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => {
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
    });
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    const unsub1 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), s => s.exists() && setShopConfig(p => ({...p, ...s.data()})));
    const unsub2 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'turnos')), s => setAppointments(s.docs.map(d => ({id:d.id, ...d.data()})).sort((a,b)=>new Date(a.date)-new Date(b.date))));
    const unsub3 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'mechanics')), s => setMechanics(s.docs.map(d => ({id:d.id, ...d.data()}))));
    const unsub4 = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'clients')), s => setClients(s.docs.map(d => ({id:d.id, ...d.data()}))));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user]);

  // --- LOGIC ---
  const saveConfig = async () => {
      try {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'main'), shopConfig);
          setConfigSuccess(true); setTimeout(() => setConfigSuccess(false), 3000); 
      } catch (e) { alert("Error al guardar."); }
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
    } catch (e) { alert("Error al reservar"); }
  };

  const createAdminAppointment = async (e) => {
    e.preventDefault();
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
    } catch (e) { alert("Error al crear"); }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    if (!loginDni || !loginPassword) return alert("Faltan datos");
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
    } else { alert("Credenciales inválidas"); setLoading(false); }
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
      if(!newMechDni || !newMechName) return alert("Faltan datos");
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'mechanics'), {
          dni: newMechDni, name: newMechName, password: newMechPassword, isAdmin: newMechIsAdmin, forcePasswordChange: true, createdAt: new Date().toISOString()
      });
      setNewMechDni(''); setNewMechName(''); setNewMechPassword(GENERIC_PASS); alert("Staff agregado.");
  };

  const triggerResetPassword = (id, name) => {
      setConfirmModal({
          title: '¿Restablecer Contraseña?',
          msg: `La clave de ${name} volverá a ser "${GENERIC_PASS}" y se le pedirá cambiarla al ingresar.`,
          action: async () => {
              try { 
                  await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'mechanics', id), { password: GENERIC_PASS, forcePasswordChange: true }); 
                  alert("Contraseña restablecida."); 
              } catch (err) { console.error(err); alert("Error."); }
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
              } catch(e) { console.error(e); alert("Error al eliminar"); }
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
    while (dates.length < 6) { if(shopConfig.workDays.includes(d.getDay())) dates.push(new Date(d)); d.setDate(d.getDate()+1); }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {dates.map((d,i) => {
            const ds = formatDateForQuery(d);
            const count = appointments.filter(a=>a.dateString===ds && a.status!=='cancelado').length;
            const full = count >= shopConfig.maxPerDay;
            const sel = selectedDate && formatDateForQuery(selectedDate) === ds;
            return <button key={i} onClick={()=>!full && setSelectedDate(d)} disabled={full} className={`p-3 rounded-lg border text-left transition-all ${full?'bg-slate-800 border-slate-700 opacity-50':sel?'bg-orange-600 border-orange-500 ring-2 ring-orange-500/30':'bg-slate-700 border-slate-600'}`}><div className="flex justify-between items-start mb-1"><span className={`text-sm font-bold ${full?'text-slate-500':'text-white'}`}>{formatDisplayDate(d).dayName}</span>{full?<XCircle size={14} className="text-red-500"/>:<CheckCircle size={14} className="text-emerald-500"/>}</div><div className="text-xs text-slate-300">{formatDisplayDate(d).date}</div><div className={`mt-2 text-xs font-semibold ${full?'text-red-400':'text-emerald-400'}`}>{full?'Agotado':`${shopConfig.maxPerDay-count} libres`}</div></button>
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
  if (view === 'force-change-password') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4"><div className="max-w-md w-full"><div className="text-center mb-8"><div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Lock size={32} className="text-white"/></div><h1 className="text-2xl font-bold text-white">Cambio Obligatorio</h1><p className="text-slate-400 mt-2">Por seguridad, actualiza tu contraseña temporal.</p></div><Card><form onSubmit={handleChangePassword} className="space-y-4"><input type="password" required className="w-full bg-slate-700 text-white rounded p-3" value={newPasswordForm.new} onChange={e=>setNewPasswordForm({...newPasswordForm,new:e.target.value})} placeholder="Nueva Clave" /><input type="password" required className="w-full bg-slate-700 text-white rounded p-3" value={newPasswordForm.confirm} onChange={e=>setNewPasswordForm({...newPasswordForm,confirm:e.target.value})} placeholder="Confirmar" /><Button type="submit" className="w-full mt-4">Actualizar</Button></form></Card></div></div>
  );

  if (view === 'login') return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-500 ${isStaffLogin?'bg-slate-950':'bg-slate-900'}`}><div className="max-w-md w-full"><div className="text-center mb-8"><div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl overflow-hidden ${isStaffLogin?'bg-blue-600':'bg-orange-600'}`}>{shopConfig.logoUrl?<img src={shopConfig.logoUrl} className="w-full h-full object-cover"/>:(isStaffLogin?<Shield size={40} className="text-white"/>:<Bike size={40} className="text-white"/>)}</div><h1 className="text-3xl font-bold text-white mb-2">{shopConfig.shopName}</h1><p className={`text-sm font-medium ${isStaffLogin?'text-blue-400':'text-slate-400'}`}>{isStaffLogin?'Acceso Staff':'Portal de Clientes'}</p></div><Card className={`${isStaffLogin?'border-blue-500/30':'border-slate-700'}`}>
        {isStaffLogin ? (
            <form onSubmit={handleStaffLogin} className="space-y-4">
                {mechanics.length===0 && <div className="bg-blue-500/20 border border-blue-500/50 p-3 rounded mb-4 text-sm text-blue-200 text-center">¡Bienvenido! Serás el <strong>Primer Admin</strong>. Esta clave será la definitiva.</div>}
                <input value={loginDni} onChange={e=>setLoginDni(e.target.value)} type="number" required className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white" placeholder="DNI" />
                <div className="relative"><input value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} type={showPassword?"text":"password"} required className="w-full bg-slate-700 border-slate-600 rounded-lg pl-3 pr-10 p-3 text-white" placeholder="Contraseña" /><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute top-3.5 right-3 text-slate-400"><Eye size={18}/></button></div>
                <Button type="submit" variant="admin" className="w-full py-3">Ingresar</Button>
            </form>
        ) : loginStep===1 ? (
            <form onSubmit={handleDniSubmit} className="space-y-4"><input value={loginDni} onChange={e=>setLoginDni(e.target.value)} type="number" required className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white" placeholder="DNI" /><Button type="submit" className="w-full py-3">Continuar</Button></form>
        ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4"><input value={loginForm.name} onChange={e=>setLoginForm({...loginForm,name:e.target.value})} required className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white" placeholder="Nombre" /><input value={loginForm.phone} onChange={e=>setLoginForm({...loginForm,phone:e.target.value})} className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white" placeholder="WhatsApp" /><input value={loginForm.bikeModel} onChange={e=>setLoginForm({...loginForm,bikeModel:e.target.value})} className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white" placeholder="Modelo Bici" /><Button type="submit" className="w-full py-3">Registrarme</Button></form>
        )}
        <div className="mt-6 pt-6 border-t border-slate-700/50 flex justify-center"><button onClick={()=>{setIsStaffLogin(!isStaffLogin);setLoginStep(1);setLoginDni('');setLoginPassword('');}} className="text-sm flex items-center gap-2 text-slate-500 hover:text-white transition">{isStaffLogin?<>Volver a Clientes</>:<><Lock size={14}/> Soy del Staff</>}</button></div>
    </Card></div></div>
  );

  const Header = () => (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10"><div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between"><div className="flex items-center gap-3"><div className={`p-2 rounded-lg w-10 h-10 flex items-center justify-center overflow-hidden ${appUser.role==='mechanic'?'bg-blue-600':'bg-orange-600'}`}>{shopConfig.logoUrl?<img src={shopConfig.logoUrl} className="w-full h-full object-cover"/>:<Bike size={24} className="text-white"/>}</div><div><h1 className="text-xl font-bold text-white leading-tight">{shopConfig.shopName}</h1><p className="text-xs text-slate-400">{appUser.role==='client'?'Cliente':(appUser.isAdmin?'Admin':'Mecánico')}</p></div></div><div className="flex items-center gap-4"><div className="hidden sm:block text-right"><p className="text-sm text-white font-medium">{appUser.name}</p><p className="text-xs text-slate-500">{appUser.dni}</p></div><Button variant="ghost" onClick={()=>{setAppUser(null);localStorage.removeItem('bikes_app_user_v8');setView('login');}}><LogOut size={20}/></Button></div></div></header>
  );

  if (view === 'client-dashboard') return (
    <div className="min-h-screen bg-slate-900 pb-20"><Header /><main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Plus className="text-orange-500"/> Reservar Turno</h2><Card><div className="mb-6"><h3 className="text-sm font-medium text-slate-400 mb-3 uppercase">1. Día</h3>{renderDateSelector()}</div>{selectedDate && <div className="mb-6 animate-in fade-in"><h3 className="text-sm font-medium text-slate-400 mb-3 uppercase">2. Horario</h3><div className="grid grid-cols-2 gap-4"><button onClick={()=>setSelectedTimeBlock('morning')} className={`p-4 rounded border flex flex-col items-center ${selectedTimeBlock==='morning'?'bg-orange-600 border-orange-500 text-white':'bg-slate-700 border-slate-600 text-slate-300'}`}><Sun size={24}/><span>Mañana</span><span className="text-xs opacity-75">08-10hs</span></button><button onClick={()=>setSelectedTimeBlock('afternoon')} className={`p-4 rounded border flex flex-col items-center ${selectedTimeBlock==='afternoon'?'bg-orange-600 border-orange-500 text-white':'bg-slate-700 border-slate-600 text-slate-300'}`}><Moon size={24}/><span>Tarde</span><span className="text-xs opacity-75">17:30-19hs</span></button></div></div>}{selectedDate && selectedTimeBlock && <div className="animate-in fade-in"><h3 className="text-sm font-medium text-slate-400 mb-3 uppercase">3. Confirmar</h3><div className="space-y-4 bg-slate-900/50 p-4 rounded border border-slate-700 mb-4"><div className="flex justify-between text-sm"><span className="text-slate-400">Bici (Editable):</span></div><input value={clientBikeModel} onChange={e=>setClientBikeModel(e.target.value)} className="w-full bg-slate-800 border-slate-600 rounded p-2 text-white" placeholder="Ej: SLP 29 Pro" /><div><label className="block text-xs text-slate-400 mb-1">Servicio</label><select value={serviceType} onChange={e=>setServiceType(e.target.value)} className="w-full bg-slate-800 border-slate-600 rounded p-2 text-white">{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div><label className="block text-xs text-slate-400 mb-1">Notas</label><textarea value={apptNotes} onChange={e=>setApptNotes(e.target.value)} rows="2" className="w-full bg-slate-800 border-slate-600 rounded p-2 text-white" placeholder="Algo más que debamos saber..."/></div></div><Button onClick={createClientAppointment} className="w-full">Confirmar</Button></div>}</Card></div>
        <div className="lg:col-span-1 space-y-4"><h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><ClipboardList className="text-orange-500"/> Mis Turnos</h2>{appointments.filter(a=>a.clientDni===appUser.dni).map(appt=><Card key={appt.id} className="relative"><div className="flex flex-col gap-2"><div className="flex justify-between mb-1"><Badge status={appt.status}/><span className="text-xs text-slate-500">#{appt.orderId}</span></div><h3 className="text-lg font-bold text-white">{appt.serviceType}</h3><p className="text-slate-400 text-sm">{appt.bikeModel}</p><div className="flex items-center gap-2 mt-2 bg-slate-900/50 p-2 rounded text-sm text-slate-200"><Calendar size={14} className="text-orange-500"/>{new Date(appt.date).toLocaleDateString()}</div></div></Card>)}</div>
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
    <div className="min-h-screen bg-slate-900 pb-20"><Header /><div className="max-w-7xl mx-auto px-4 mt-6 border-b border-slate-700 flex flex-wrap gap-6 overflow-x-auto"><button onClick={()=>setSubView('dashboard')} className={`pb-3 text-sm font-medium transition ${subView==='dashboard'?'text-blue-500 border-b-2 border-blue-500':'text-slate-400'}`}>Panel</button>{appUser.isAdmin && <><button onClick={()=>setSubView('clients')} className={`pb-3 text-sm font-medium transition flex items-center gap-2 ${subView==='clients'?'text-blue-500 border-b-2 border-blue-500':'text-slate-400'}`}><Users size={16}/> Clientes</button><button onClick={()=>setSubView('stats')} className={`pb-3 text-sm font-medium transition flex items-center gap-2 ${subView==='stats'?'text-blue-500 border-b-2 border-blue-500':'text-slate-400'}`}><BarChart3 size={16}/> Stats</button><button onClick={()=>setSubView('config')} className={`pb-3 text-sm font-medium transition flex items-center gap-2 ${subView==='config'?'text-blue-500 border-b-2 border-blue-500':'text-slate-400'}`}><Settings size={16}/> Config</button><button onClick={()=>setSubView('mechanics-mgmt')} className={`pb-3 text-sm font-medium transition flex items-center gap-2 ${subView==='mechanics-mgmt'?'text-blue-500 border-b-2 border-blue-500':'text-slate-400'}`}><Shield size={16}/> Staff</button></>}</div>
    <main className="max-w-7xl mx-auto px-4 py-8">
        {confirmModal && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"><Card className="w-full max-w-sm border-red-500/50"><h3 className="text-xl font-bold text-white mb-2">{confirmModal.title}</h3><p className="text-slate-300 mb-6">{confirmModal.msg}</p><div className="flex gap-3"><Button variant="secondary" onClick={()=>setConfirmModal(null)} className="flex-1">Cancelar</Button><Button variant="danger" onClick={()=>{confirmModal.action();}} className="flex-1">Confirmar</Button></div></Card></div>}
        
        {showAdminApptModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><Card className="w-full max-w-lg relative"><button onClick={()=>setShowAdminApptModal(false)} className="absolute top-4 right-4 text-slate-400"><XCircle/></button><h3 className="text-xl font-bold text-white mb-4">Nuevo Turno (Manual)</h3><form onSubmit={createAdminAppointment} className="space-y-4"><input value={adminFormData.bikeModel} onChange={e=>setAdminFormData({...adminFormData, bikeModel:e.target.value})} className="w-full bg-slate-700 text-white p-3 rounded" placeholder="Modelo Bici" /><input value={adminFormData.phone} onChange={e=>setAdminFormData({...adminFormData, phone:e.target.value})} type="tel" className="w-full bg-slate-700 text-white p-3 rounded" placeholder="Teléfono" /><div className="grid grid-cols-2 gap-4"><input type="datetime-local" value={adminFormData.date} onChange={e=>setAdminFormData({...adminFormData, date:e.target.value})} className="w-full bg-slate-700 text-white p-3 rounded [color-scheme:dark]" /><select value={adminFormData.serviceType} onChange={e=>setAdminFormData({...adminFormData, serviceType:e.target.value})} className="w-full bg-slate-700 p-3 rounded text-white">{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><Button type="submit" variant="admin" className="w-full">Guardar</Button></form></Card></div>}

        {subView === 'dashboard' && <>
            {receptionModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><Card className="w-full max-w-lg relative"><button onClick={()=>setReceptionModal(null)} className="absolute top-4 right-4 text-slate-400"><XCircle/></button><h3 className="text-xl font-bold text-white mb-4">Recepción</h3><div className="bg-slate-900/50 p-3 rounded mb-4 text-sm text-slate-300"><p>Cliente: {receptionModal.appt.clientName}</p></div><form onSubmit={handleReceptionConfirm} className="space-y-4"><div><label className="text-sm text-slate-400">Modelo Bici</label><input value={receptionModal.bikeModel} onChange={e=>setReceptionModal({...receptionModal, bikeModel:e.target.value})} className="w-full bg-slate-700 text-white rounded p-2"/></div><div><label className="text-sm text-slate-400">Servicio</label><select value={receptionModal.serviceType} onChange={e=>setReceptionModal({...receptionModal, serviceType:e.target.value})} className="w-full bg-slate-700 rounded p-2 text-white">{SERVICE_TYPES.map(s=><option key={s} value={s}>{s}</option>)}</select></div><div><label className="text-sm text-slate-400">Notas</label><textarea value={receptionModal.notes} onChange={e=>setReceptionModal({...receptionModal, notes:e.target.value})} rows="3" className="w-full bg-slate-700 text-white rounded p-2" placeholder="Algo más que debamos saber..."/></div><Button type="submit" className="w-full">Confirmar</Button></form></Card></div>}
            
            <div className="mb-6 grid grid-cols-1 md:grid-cols-12 gap-4"><div className="md:col-span-4 relative"><Search className="absolute left-3 top-2.5 text-slate-500" size={18}/><input placeholder="Buscar ID, Cliente..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg pl-10 p-2 text-white focus:outline-none focus:border-blue-500"/></div><div className="md:col-span-3"><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-white"><option value="all">Todos</option><option value="pendiente">Pendientes</option><option value="recibido">En Espera</option><option value="en-proceso">En Taller</option><option value="listo">Listos</option></select></div><div className="md:col-span-3"><input type="date" value={dateFilterStart} onChange={e=>setDateFilterStart(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded-lg p-2 text-white [color-scheme:dark]"/></div><div className="md:col-span-2"><Button variant="secondary" onClick={printList} className="w-full h-full"><Printer size={16}/> Lista</Button></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"><div className="group"><Card className="h-full border-l-4 border-l-blue-500 flex flex-col justify-center items-center cursor-pointer hover:bg-slate-750 transition" onClick={()=>setShowAdminApptModal(true)}><div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition"><Plus size={32} className="text-blue-400"/></div><h3 className="text-white font-bold">Nuevo Turno</h3></Card></div>{filteredAppts.map(appt=><Card key={appt.id} className={`flex flex-col relative ${appt.status==='listo'?'border-emerald-500/50 bg-emerald-900/10':''}`}><div className="flex justify-between items-start mb-3"><div><h3 className="text-white font-bold text-lg leading-tight">{appt.bikeModel}</h3><div className="flex items-center gap-1 text-slate-400 text-xs mt-1"><User size={12}/> {appt.clientName}</div><div className="text-[10px] text-slate-500 mt-0.5">#{appt.orderId || appt.id.slice(0,4)}</div></div><Badge status={appt.status}/></div><div className="flex-grow space-y-2 mb-4"><p className="text-blue-400 text-sm font-medium">{appt.serviceType}</p><div className="flex flex-wrap gap-2 text-xs text-slate-500"><span className="bg-slate-900/50 px-2 py-1 rounded flex gap-1"><Calendar size={12}/> {new Date(appt.date).toLocaleDateString()}</span></div>{appt.mechanicName && <div className="text-xs text-slate-300 flex gap-1"><Wrench size={12}/> {appt.mechanicName}</div>}</div><div className="border-t border-slate-700 pt-3 grid gap-2">{appt.status==='pendiente' && <Button variant="secondary" className="text-xs w-full" onClick={()=>setReceptionModal({appt, bikeModel:appt.bikeModel, serviceType:appt.serviceType, notes:appt.notes||''})}><FileText size={14}/> Recepcionar</Button>}{appt.status==='recibido' && <Button variant="admin" className="text-xs w-full" onClick={()=>updateStatus(appt.id,'en-proceso')}><Wrench size={14}/> Iniciar Taller</Button>}{appt.status==='en-proceso' && <Button variant="success" className="text-xs w-full" onClick={()=>updateStatus(appt.id,'listo')}><CheckCircle size={14}/> Finalizar</Button>}{appt.status==='listo' && <Button variant="whatsapp" className="text-xs w-full" onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)}><MessageCircle size={14}/> Avisar</Button>}<div className="flex justify-between pt-2 border-t border-slate-700/50"><button onClick={()=>sendWhatsApp(appt.clientPhone, appt.clientName, appt.bikeModel, appt.status)} className="p-2 rounded bg-slate-700 text-green-500"><MessageCircle size={16}/></button><button onClick={()=>updateStatus(appt.id,'pendiente')} className="p-2 rounded hover:bg-red-900/20 text-slate-500 hover:text-red-400"><RotateCcw size={16}/></button></div></div></Card>)}</div>
        </>}

        {subView === 'clients' && appUser.isAdmin && <div className="space-y-6">
            {editingClient && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><Card className="w-full max-w-md relative"><button onClick={()=>setEditingClient(null)} className="absolute top-4 right-4 text-slate-400"><XCircle/></button><h3 className="text-xl font-bold text-white mb-4">Editar Cliente</h3><form onSubmit={handleUpdateClient} className="space-y-4"><div><label className="block text-sm text-slate-400">Nombre</label><input value={editingClient.name} onChange={e=>setEditingClient({...editingClient,name:e.target.value})} className="w-full bg-slate-700 text-white rounded p-2 border border-slate-600"/></div><div><label className="block text-sm text-slate-400">Teléfono</label><input value={editingClient.phone} onChange={e=>setEditingClient({...editingClient,phone:e.target.value})} className="w-full bg-slate-700 text-white rounded p-2 border border-slate-600"/></div><div><label className="block text-sm text-slate-400">Bici (Default)</label><input value={editingClient.bikeModel} onChange={e=>setEditingClient({...editingClient,bikeModel:e.target.value})} className="w-full bg-slate-700 text-white rounded p-2 border border-slate-600"/></div><Button type="submit" className="w-full">Guardar</Button></form></Card></div>}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{clients.map(client=>{
                const clientServices=appointments.filter(a=>a.clientDni===client.dni&&a.status==='listo');
                const lastServiceDate=clientServices.length>0?new Date(Math.max(...clientServices.map(a=>new Date(a.date)))):null;
                return <Card key={client.id} className="relative group hover:border-slate-600 transition"><div className="flex items-start justify-between mb-2"><div className="flex items-center gap-3"><div className="bg-slate-700 p-2 rounded-full"><User size={20} className="text-slate-300"/></div><div><h3 className="font-bold text-white">{client.name}</h3><p className="text-xs text-slate-500">{client.dni}</p></div></div><button onClick={()=>setEditingClient(client)} className="text-slate-500 hover:text-blue-400 p-1"><Edit size={16}/></button></div><div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-2 text-xs"><div className="bg-slate-900/50 p-2 rounded"><div className="text-slate-500 mb-1 flex items-center gap-1"><Wrench size={10} /> Servicios</div><div className="text-lg font-bold text-blue-400">{clientServices.length}</div></div><div className="bg-slate-900/50 p-2 rounded"><div className="text-slate-500 mb-1 flex items-center gap-1"><History size={10} /> Último</div><div className="text-white">{lastServiceDate ? lastServiceDate.toLocaleDateString() : '-'}</div></div></div><div className="mt-3"><button onClick={()=>sendWhatsApp(client.phone,client.name,client.bikeModel||'bici','consulta')} className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-green-900/30 text-slate-300 hover:text-green-500 py-2 rounded text-xs transition-colors"><MessageCircle size={14}/> Contactar</button></div></Card>;
            })}</div></div>}

        {subView === 'mechanics-mgmt' && appUser.isAdmin && <div className="max-w-3xl mx-auto"><Card className="mb-8 border-blue-500/30"><h3 className="text-white font-bold mb-4 flex items-center gap-2"><Shield size={20} className="text-blue-500"/> Nuevo Staff</h3><form onSubmit={addMechanic} className="flex flex-col md:flex-row gap-4 items-end"><div className="w-full"><label className="text-xs text-slate-400 block mb-1">Nombre</label><input required value={newMechName} onChange={e=>setNewMechName(e.target.value)} className="w-full bg-slate-700 text-white rounded p-2 text-sm" placeholder="Nombre"/></div><div className="w-full"><label className="text-xs text-slate-400 block mb-1">DNI (Usuario)</label><input required value={newMechDni} onChange={e=>setNewMechDni(e.target.value)} type="number" className="w-full bg-slate-700 text-white rounded p-2 text-sm" placeholder="DNI"/></div><div className="w-full"><label className="text-xs text-slate-400 block mb-1">Contraseña ({GENERIC_PASS})</label><input required value={newMechPassword} onChange={e=>setNewMechPassword(e.target.value)} type="text" className="w-full bg-slate-700 text-white rounded p-2 text-sm"/></div><div className="flex items-center gap-2 pb-2"><input type="checkbox" checked={newMechIsAdmin} onChange={e=>setNewMechIsAdmin(e.target.checked)}/><label className="text-sm text-slate-300">Admin?</label></div><Button type="submit" variant="admin"><Plus size={16}/> Crear</Button></form></Card><div className="space-y-3">{mechanics.map(m=><div key={m.id} className="flex justify-between bg-slate-800 p-4 rounded-lg border border-slate-700"><div className="flex gap-3"><div className={`p-2 rounded-full ${m.isAdmin?'bg-blue-600/20':'bg-slate-700'}`}>{m.isAdmin?<Shield size={20} className="text-blue-400"/>:<Wrench size={20} className="text-slate-400"/>}</div><div><p className="text-white font-medium">{m.name}</p><p className="text-sm text-slate-500">{m.dni}</p></div></div><div className="flex gap-2"><Button variant="secondary" className="py-1 px-3" onClick={()=>triggerResetPassword(m.id, m.name)}><RotateCcw size={14}/></Button><Button variant="danger" className="py-1 px-3" onClick={()=>triggerRemoveMechanic(m.id, m.name)}><Trash2 size={14}/></Button></div></div>)}</div></div>}
        
        {subView === 'config' && <div className="max-w-2xl mx-auto"><Card><div className="flex justify-between mb-6"><h3 className="text-white font-bold flex gap-2"><Settings size={20}/> Configuración</h3>{configSuccess && <span className="text-emerald-400 text-sm font-bold animate-pulse">¡Guardado!</span>}</div><div className="space-y-6"><div><label className="block text-sm text-slate-400 mb-2">Días Laborables</label><div className="flex gap-2">{['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((day,idx)=><button key={idx} onClick={()=>{const n=shopConfig.workDays.includes(idx)?shopConfig.workDays.filter(d=>d!==idx):[...shopConfig.workDays,idx];setShopConfig({...shopConfig,workDays:n})}} className={`w-10 h-10 rounded-full text-sm font-bold transition ${shopConfig.workDays.includes(idx)?'bg-orange-600 text-white':'bg-slate-700 text-slate-400'}`}>{day[0]}</button>)}</div></div><div className="grid grid-cols-2 gap-4"><input value={shopConfig.shopName} onChange={e=>setShopConfig({...shopConfig,shopName:e.target.value})} className="w-full bg-slate-700 text-white rounded p-2" placeholder="Nombre Taller"/><input value={shopConfig.shopPhone} onChange={e=>setShopConfig({...shopConfig,shopPhone:e.target.value})} className="w-full bg-slate-700 text-white rounded p-2" placeholder="Teléfono"/><input value={shopConfig.shopAddress} onChange={e=>setShopConfig({...shopConfig,shopAddress:e.target.value})} className="col-span-2 w-full bg-slate-700 text-white rounded p-2" placeholder="Dirección"/><div className="col-span-2"><label className="block text-sm text-slate-400 mb-1">Logo URL / Upload</label><div className="flex gap-4">{shopConfig.logoUrl && <img src={shopConfig.logoUrl} className="w-16 h-16 object-cover rounded border border-slate-600"/>}<input type="file" onChange={handleLogoUpload} className="text-sm text-slate-400"/></div></div><input type="number" value={shopConfig.maxPerDay} onChange={e=>setShopConfig({...shopConfig,maxPerDay:parseInt(e.target.value)})} className="w-full bg-slate-700 text-white rounded p-2" placeholder="Max Turnos"/></div><Button onClick={saveConfig} className="w-full">Guardar</Button></div></Card></div>}
        
        {subView === 'stats' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"><Card><h3 className="text-white font-bold mb-6 flex items-center gap-2"><BarChart3 size={20} className="text-blue-500"/> Reparaciones</h3><div className="space-y-4">{mechanics.filter(m=>!m.isAdmin).map(m=>{const count=appointments.filter(a=>a.mechanicId===m.dni&&a.status==='listo').length;return <div key={m.id}><div className="flex justify-between text-sm text-slate-300 mb-1"><span>{m.name}</span><span>{count}</span></div><div className="h-2 bg-slate-700 rounded-full"><div className="h-full bg-blue-500" style={{width:`${Math.min((count/10)*100,100)}%`}}></div></div></div>})}</div></Card></div>}
    </main></div>
  );
}