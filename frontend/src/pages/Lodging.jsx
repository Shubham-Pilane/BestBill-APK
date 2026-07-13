import React, { useState, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { PlusCircle, Bed, LayoutGrid, Search, X, Hash, Trash2, Hotel } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RoomOrderModal from '../components/RoomOrderModal';
import { QRCodeCanvas } from 'qrcode.react';
import { QrCode, Download } from 'lucide-react';

const Lodging = () => {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddRoomOpen, setAddRoomOpen] = useState(false);
  const [roomConfigs, setRoomConfigs] = useState([{ floor: 'Floor 1', count: '10' }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clickShield, setClickShield] = useState(false);

  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editData, setEditData] = useState({ room_number: '', room_name: '', floor: 'Floor 1', status: 'available' });

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [isQRModalOpen, setQRModalOpen] = useState(false);

  const [menuData, setMenuData] = useState({ categories: [], items: [] });
  const [lanIp, setLanIp] = useState('127.0.0.1');

  const fetchRooms = async () => {
    try {
      const [roomsRes, catRes, itemsRes] = await Promise.all([
        api.get('/rooms'),
        api.get('/menu/categories'),
        api.get('/menu/items')
      ]);
      setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
      setMenuData({
        categories: catRes.data || [],
        items: itemsRes.data || []
      });
    } catch (err) {
      console.error('Fetch error:', err);
      toast.error('Failed to load lodging data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();

    const fetchLanIp = async () => {
      // 1. Try fetching saved guestIp from printer settings
      try {
        const configRes = await api.get('/hotel/printers-config');
        if (configRes.data && configRes.data.guestIp) {
          setLanIp(configRes.data.guestIp);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch guestIp from config:', err);
      }

      // 2. Fallback to desktop autodetected LAN IP
      if (window.bestbillDesktop?.getLanIp) {
        try {
          const ip = await window.bestbillDesktop.getLanIp();
          setLanIp(ip);
        } catch (err) {
          console.error('Failed to get LAN IP:', err);
        }
      }
    };
    fetchLanIp();

    const serverUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:8080';
    const socket = io(serverUrl, { transports: ['websocket'] });

    if (user?.hotel_id) {
      socket.emit('register-hotel', { hotelId: user.hotel_id });
    }

    socket.on('room-update', () => {
      fetchRooms();
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const addRoomsBatch = async (e) => {
    e.preventDefault();
    if (!isOwner) return;
    
    const loadingToast = toast.loading('Establishing lodging infrastructure...');
    try {
      await api.post('/rooms/batch', { roomConfigs });
      fetchRooms();
      setAddRoomOpen(false);
      toast.success('Rooms added successfully!', { id: loadingToast });
    } catch (err) {
      toast.error('Error adding rooms', { id: loadingToast });
    }
  };

  const initiateEditRoom = (e, room) => {
    e.stopPropagation();
    setEditingRoom(room);
    setEditData({ 
        room_number: room.room_number, 
        room_name: room.room_name || room.room_number,
        floor: room.floor || 'Floor 1',
        status: room.status || 'available'
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/rooms/${editingRoom.id}`, editData);
      toast.success('Room details refined');
      setEditModalOpen(false);
      fetchRooms();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update room');
    }
  };

  const deleteRoom = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this room?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success('Room removed');
      fetchRooms();
    } catch (err) {
      toast.error('Deletion failed');
    }
  };

  const groupedRooms = useMemo(() => (rooms || []).reduce((acc, room) => {
    const floor = room.floor || 'Floor 1';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {}), [rooms]);

  const floorOrder = (name) => {
    if (name.startsWith('Floor ')) return parseInt(name.replace('Floor ', '')) || 99;
    if (name === 'Main Hall') return 100;
    if (name === 'Party Hall') return 101;
    if (name === 'Rooftop') return 102;
    if (name === 'Garden') return 103;
    if (name === 'Family Section') return 104;
    return 200;
  };

  const floors = useMemo(() => Object.keys(groupedRooms).sort((a, b) => floorOrder(a) - floorOrder(b)), [groupedRooms]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--bg-border)', borderTopColor: '#0ea5e9', animation: 'spin 1s linear infinite' }}></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '64px', width: '100%', maxWidth: '1440px', overflow: 'hidden' }}>
      {/* Hotel Branding Area */}
      <div className="hotel-title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            backgroundColor: 'rgba(14, 165, 233, 0.1)', 
            borderRadius: '20px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px solid rgba(14, 165, 233, 0.2)'
          }}>
            <Hotel color="#0ea5e9" size={32} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{fontSize: '36px', fontWeight: 950, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>{user?.hotel_name || 'BestBill Hotel'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700 }}>
              <span>Proprietor: {user?.name || 'A'}</span>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--bg-border)' }}></div>
              <span style={{ color: '#10b981' }}>Active Session</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '40px', alignItems: 'center' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Current Date</span>
            <span style={{fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
          <h2 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Bed style={{ color: '#0ea5e9' }} size={24} />
            Lodging Control
          </h2>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', top: '14px', left: '16px', color: 'var(--text-muted)' }} size={18} />
            <input
              type="text"
              placeholder="Search rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{width: '100%', backgroundColor: 'var(--bg-card)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '12px 16px 12px 48px', borderRadius: '16px', outline: 'none', fontSize: '14px', fontWeight: 600 }}
            />
          </div>
        </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              onClick={() => setQRModalOpen(true)}
              style={{display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', padding: '14px 24px', borderRadius: '16px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', border: '2px solid var(--bg-border)' }}
            >
              <QrCode size={20} />
              Guest QR
            </button>
            {isOwner && (
              <button
                onClick={() => setAddRoomOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#0ea5e9', color: 'white', padding: '14px 28px', borderRadius: '16px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', border: 'none', boxShadow: '0 8px 16px rgba(14, 165, 233, 0.2)' }}
              >
                <PlusCircle size={20} />
                Setup New Rooms
              </button>
            )}
          </div>
      </div>

      {floors.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', backgroundColor: 'var(--bg-card)', borderRadius: '32px', border: '2px dashed var(--bg-border)', textAlign: 'center' }}>
          <Bed size={48} style={{ color: 'var(--bg-border)', marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '18px', fontWeight: 600 }}>No rooms configured for this hotel.</p>
          <button onClick={() => setAddRoomOpen(true)} style={{ color: '#0ea5e9', fontWeight: 900, background: 'none', border: 'none', cursor: 'pointer', marginTop: '12px', fontSize: '16px', textDecoration: 'underline' }}>Setup Lodging Layout</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
          {floors.map(floor => (
            <div key={floor} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{floor}</h2>
                  <div style={{ flex: 1, height: '2px', backgroundColor: 'var(--bg-border)' }}></div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800 }}>{groupedRooms[floor].length} ROOMS</span>
               </div>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '24px' }}>
                  {groupedRooms[floor].map((room) => (
                      <RoomCard 
                        key={room.id}
                        room={room}
                        onOpen={(r) => {
                          setSelectedRoom(r);
                          setBookingModalOpen(true);
                        }}
                        onEdit={initiateEditRoom}
                        onDelete={deleteRoom}
                        searchQuery={searchQuery}
                      />
                   ))}
               </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Room Batch Modal */}
      {isAddRoomOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
           <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)', borderRadius: '32px', padding: '40px', border: '1px solid var(--border-rgba-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h3 style={{fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Initialize Lodging</h3>
                <button onClick={() => setAddRoomOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
              </div>
              <form onSubmit={addRoomsBatch} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 {roomConfigs.map((config, index) => (
                    <div key={index} style={{ padding: '20px', backgroundColor: 'var(--bg-base)', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 900 }}>FLOOR</label>
                          <select 
                            value={config.floor} 
                            onChange={(e) => {
                                const newConfigs = [...roomConfigs];
                                newConfigs[index].floor = e.target.value;
                                setRoomConfigs(newConfigs);
                            }}
                            style={{width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '12px', borderRadius: '12px' }}
                          >
                             {[...Array(5)].map((_, i) => <option key={i+1} value={`Floor ${i+1}`}>Floor {i+1}</option>)}
                             <option value="Main Hall">Main Hall</option>
                             <option value="Party Hall">Party Hall</option>
                             <option value="Rooftop">Rooftop</option>
                             <option value="Garden">Garden</option>
                             <option value="Family Section">Family Section</option>
                          </select>
                       </div>
                       <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 900 }}>ROOM BATCH COUNT</label>
                          <input 
                            type="number" 
                            value={config.count}
                            onChange={(e) => {
                                const newConfigs = [...roomConfigs];
                                newConfigs[index].count = e.target.value;
                                setRoomConfigs(newConfigs);
                            }}
                            style={{width: '100%', backgroundColor: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', padding: '12px', borderRadius: '12px', fontWeight: 900 }} 
                          />
                       </div>
                    </div>
                 ))}
                 <button type="submit" style={{ width: '100%', backgroundColor: '#0ea5e9', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 800, cursor: 'pointer' }}>Deploy Rooms</button>
              </form>
           </div>
        </div>
      )}

      {selectedRoom && isBookingModalOpen && (
        <RoomOrderModal 
          room={rooms.find(r => r.id === selectedRoom.id) || selectedRoom} 
          initialMenu={menuData}
          onClose={() => {
            setBookingModalOpen(false);
            setClickShield(true);
            setTimeout(() => setClickShield(false), 800);
            setSelectedRoom(null);
          }} 
          onRefresh={fetchRooms}
        />
      )}
      {clickShield && <div style={{ position: 'fixed', inset: 0, zIndex: 99999, cursor: 'not-allowed' }} />}

      {/* Edit/Rename Modal */}
      {isEditModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
           <div style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-card)', borderRadius: '32px', padding: '40px' }}>
              <h3 style={{fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '24px' }}>Rename Room</h3>
              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Room Name/Label</label>
                    <input 
                      type="text" value={editData.room_name} 
                      onChange={(e) => setEditData({...editData, room_name: e.target.value})}
                      style={{width: '100%', backgroundColor: 'var(--bg-base)', border: '2px solid var(--bg-border)', color: 'var(--text-primary)', padding: '14px', borderRadius: '16px', fontWeight: 800 }}
                    />
                 </div>
                 <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={() => setEditModalOpen(false)} style={{flex: 1, backgroundColor: 'var(--bg-border)', color: 'var(--text-primary)', padding: '14px', borderRadius: '16px', border: 'none' }}>Cancel</button>
                    <button type="submit" style={{ flex: 2, backgroundColor: '#0ea5e9', color: 'white', padding: '14px', borderRadius: '16px', border: 'none', fontWeight: 800 }}>Save Changes</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Guest QR Modal */}
      {isQRModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(32px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: '24px' }}>
           <div style={{ width: '100%', maxWidth: '440px', backgroundColor: 'var(--bg-card)', borderRadius: '48px', padding: '48px', border: '1px solid var(--border-rgba-05)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h3 style={{fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>Hotel Guest QR</h3>
                <button onClick={() => setQRModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={32} /></button>
              </div>
              
              <div style={{backgroundcolor: 'var(--text-primary)', padding: '32px', borderRadius: '32px', display: 'inline-block', marginBottom: '32px' }}>
                  <QRCodeCanvas 
                    id="hotel-qr-code"
                    value={`http://${lanIp}:5000/#/guest/order/${user.hotel_id}`}
                    size={240}
                    level="H"
                    includeMargin={false}
                  />
              </div>

              <div style={{ marginBottom: '32px' }}>
                  <h4 style={{fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{user.hotel_name}</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, margin: 0 }}>Place in every room. Guests can scan this to view menu and order instantly.</p>
              </div>

              <button 
                onClick={() => {
                    const canvas = document.getElementById('hotel-qr-code');
                    const url = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.download = `${user.hotel_name.replace(/\s+/g, '_')}_QR.png`;
                    link.href = url;
                    link.click();
                    toast.success('QR Code Downloaded');
                }}
                style={{ width: '100%', backgroundColor: '#0ea5e9', color: 'white', padding: '20px', borderRadius: '20px', fontSize: '16px', fontWeight: 900, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
              >
                <Download size={20} /> Download JPG Assets
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

// Memoized Room Card component
const RoomCard = React.memo(({ room, onOpen, onEdit, onDelete, searchQuery }) => {
  const isOccupied = room.status === 'occupied';
  const matchesSearch = room.room_number.includes(searchQuery) || 
                       (room.room_name && room.room_name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!matchesSearch) return null;

  return (
    <div
      onClick={() => onOpen(room)}
      style={{ 
        backgroundColor: 'var(--bg-card)', 
        borderRadius: '32px', 
        padding: '32px', 
        border: isOccupied ? '2px solid rgba(244, 63, 94, 0.4)' : '2px solid rgba(16, 185, 129, 0.4)', 
        position: 'relative', 
        overflow: 'hidden', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      {isOccupied && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: '#f43f5e' }}></div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ROOM {room.room_number}</span>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button onClick={(e) => onEdit(e, room)} style={{ color: '#0ea5e9', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, fontSize: '11px' }}>RENAME</button>
           <button onClick={(e) => onDelete(e, room.id)} style={{ color: '#f43f5e', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div>
        <h3 style={{fontSize: '32px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>{room.room_name || room.room_number}</h3>
        <span style={{ fontSize: '12px', fontWeight: 800, color: isOccupied ? '#f43f5e' : '#10b981' }}>{room.status.toUpperCase()}</span>
      </div>
      {isOccupied && (
        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-rgba-05)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>{room.guest_name}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Check-in: {new Date(room.check_in_date).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
});

export default Lodging;
