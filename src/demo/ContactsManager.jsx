import React, { useState } from 'react';
import { 
  X, 
  Users, 
  Share2, 
  UserPlus, 
  RefreshCw, 
  Check, 
  Copy, 
  Link,
  Smartphone,
  Mail,
  User,
  UserCheck,
  Shield,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight
} from 'lucide-react';

// Mock data for our component
const MOCK_FRIENDS = [
  { id: 1, name: "Alex Johnson", email: "alex@example.com", avatarUrl: null, isOnline: true, ragConnect: true, team: "Engineering" },
  { id: 2, name: "Jamie Smith", email: "jamie@example.com", avatarUrl: null, isOnline: false, ragConnect: false, team: "Engineering" },
  { id: 3, name: "Taylor Wilson", email: "taylor@example.com", avatarUrl: null, isOnline: true, ragConnect: true, team: "Engineering" },
  { id: 4, name: "Morgan Lee", email: "morgan@example.com", avatarUrl: null, isOnline: false, ragConnect: false, team: "Design" },
  { id: 5, name: "Casey Brown", email: "casey@example.com", avatarUrl: null, isOnline: true, ragConnect: false, team: "Product" },
];

const MOCK_PENDING = [
  { id: 101, name: "Riley Adams", email: "riley@example.com", status: "incoming", date: "2025-04-20" },
  { id: 102, name: "Jordan Clark", email: "jordan@example.com", status: "outgoing", date: "2025-04-22" },
];

const MOCK_TEAMS = [
  { id: 1, name: "Engineering" },
  { id: 2, name: "Design" },
  { id: 3, name: "Product" },
];

// Preview component for demo purposes
const ContactsManagerPreview = () => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  
  return (
    <div className="relative bg-gray-100 h-screen overflow-hidden flex items-center justify-center p-4">
      <button 
        onClick={() => setDrawerOpen(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
      >
        Open Contacts
      </button>
      
      <ContactsManager 
        isOpen={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
      />
    </div>
  );
};

const ContactsManager = ({ isOpen = true, onClose = () => {} }) => {
  const [activeTab, setActiveTab] = useState('friends');
  const [inviteCode, setInviteCode] = useState('');
  const [codeGenerated, setCodeGenerated] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [showOnlyRagConnect, setShowOnlyRagConnect] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  
  const generateInviteCode = () => {
    // In a real app, this would make an API call
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    setInviteCode(newCode);
    setCodeGenerated(true);
    
    // Reset the copied state
    setCopiedCode(false);
  };
  
  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    
    // Reset copied state after 2 seconds
    setTimeout(() => {
      setCopiedCode(false);
    }, 2000);
  };
  
  const acceptInviteCode = () => {
    // In a real app, this would make an API call to accept the code
    alert(`Code "${inputCode}" accepted! You'll see your new connection once they accept.`);
    setInputCode('');
  };
  
  const toggleRagConnect = (userId) => {
    // This would be handled through an API in a real app
    // Here we're just toggling the mock data
    MOCK_FRIENDS.forEach(friend => {
      if (friend.id === userId) {
        friend.ragConnect = !friend.ragConnect;
      }
    });
    
    // Force a re-render
    setActiveTab(activeTab);
  };
  
  // Filter friends based on search query and filters
  const filteredFriends = MOCK_FRIENDS.filter(friend => {
    const matchesSearch = friend.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         friend.email.toLowerCase().includes(searchQuery.toLowerCase());
                         
    const matchesTeam = selectedTeam === 'all' || friend.team === selectedTeam;
    
    const matchesRagConnect = !showOnlyRagConnect || friend.ragConnect;
    
    return matchesSearch && matchesTeam && matchesRagConnect;
  });

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-white shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4">
        <h2 className="text-lg font-semibold">Contacts & Invites</h2>
        <button 
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === 'friends' 
              ? 'text-purple-600 border-b-2 border-purple-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('friends')}
        >
          <Users size={16} className="inline-block mr-1" />
          Friends
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === 'invites' 
              ? 'text-purple-600 border-b-2 border-purple-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('invites')}
        >
          <UserPlus size={16} className="inline-block mr-1" />
          Invites
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium ${
            activeTab === 'codes' 
              ? 'text-purple-600 border-b-2 border-purple-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('codes')}
        >
          <Share2 size={16} className="inline-block mr-1" />
          Share
        </button>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <div className="p-4 space-y-4">
            {/* Search and Filters */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              
              <div className="flex items-center justify-between mt-2">
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md"
                >
                  <option value="all">All Teams</option>
                  {MOCK_TEAMS.map(team => (
                    <option key={team.id} value={team.name}>{team.name}</option>
                  ))}
                </select>
                
                <div className="flex items-center">
                  <label className="flex items-center text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={showOnlyRagConnect}
                      onChange={() => setShowOnlyRagConnect(!showOnlyRagConnect)}
                      className="mr-2"
                    />
                    RAG Connect Only
                  </label>
                </div>
              </div>
            </div>
            
            {/* Friends List */}
            <div className="space-y-2">
              {filteredFriends.length === 0 ? (
                <div className="text-center p-4 text-gray-500">
                  No contacts found matching your filters
                </div>
              ) : (
                filteredFriends.map(friend => (
                  <div key={friend.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt={friend.name} className="w-full h-full rounded-full" />
                        ) : (
                          <User size={20} className="text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center">
                          {friend.name}
                          <div className={`w-2 h-2 rounded-full ml-2 ${friend.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        </div>
                        <div className="text-sm text-gray-500">{friend.email}</div>
                        <div className="text-xs text-gray-400">{friend.team}</div>
                      </div>
                      <div className="flex flex-col items-end">
                        <button 
                          className={`relative w-10 h-5 rounded-full ${friend.ragConnect ? 'bg-purple-600' : 'bg-gray-300'} transition-colors`}
                          onClick={() => toggleRagConnect(friend.id)}
                        >
                          <span 
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transform transition-transform ${friend.ragConnect ? 'translate-x-5' : 'translate-x-0'}`}
                          ></span>
                        </button>
                        <span className="text-xs mt-1 text-gray-500">RAG Connect</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        
        {/* Invites Tab */}
        {activeTab === 'invites' && (
          <div className="p-4 space-y-4">
            {/* Accept Code Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3">Accept an Invite</h3>
              <div className="flex">
                <input
                  type="text"
                  placeholder="Enter invite code"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md text-sm"
                  maxLength={8}
                />
                <button
                  onClick={acceptInviteCode}
                  disabled={!inputCode}
                  className={`px-4 py-2 rounded-r-md text-white ${inputCode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-300 cursor-not-allowed'}`}
                >
                  <Check size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Enter a code you received from a friend to connect
              </p>
            </div>
            
            {/* Pending Invites */}
            <div>
              <h3 className="font-medium text-gray-800 mb-3">Pending Invites</h3>
              
              {MOCK_PENDING.length === 0 ? (
                <div className="bg-gray-50 p-4 text-center text-gray-500 text-sm rounded-md">
                  No pending invites
                </div>
              ) : (
                <div className="space-y-2">
                  {MOCK_PENDING.map(invite => (
                    <div key={invite.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                        {invite.status === 'incoming' ? (
                          <UserPlus size={16} className="text-purple-600" />
                        ) : (
                          <Clock size={16} className="text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{invite.name}</div>
                        <div className="text-xs text-gray-500">{invite.email}</div>
                      </div>
                      {invite.status === 'incoming' ? (
                        <div className="flex space-x-1">
                          <button className="p-1.5 bg-green-100 text-green-600 rounded-full hover:bg-green-200">
                            <CheckCircle size={16} />
                          </button>
                          <button className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200">
                            <XCircle size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Sent {new Date(invite.date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Codes Tab */}
        {activeTab === 'codes' && (
          <div className="p-4 space-y-4">
            {/* Generate Code Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-3">Generate Invite Code</h3>
              
              {!codeGenerated ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Create a unique code to share with friends so they can connect with you.
                  </p>
                  <button
                    onClick={generateInviteCode}
                    className="w-full py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Generate Code
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex mb-3">
                    <div className="flex-1 px-4 py-3 bg-gray-100 font-mono text-center text-lg border-l border-t border-b border-gray-300 rounded-l-md">
                      {inviteCode}
                    </div>
                    <button
                      onClick={copyInviteCode}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 border-t border-r border-b border-gray-300 rounded-r-md"
                    >
                      {copiedCode ? (
                        <Check size={18} className="text-green-600" />
                      ) : (
                        <Copy size={18} className="text-gray-600" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    This code will work for 7 days or until someone accepts it
                  </p>
                  <div className="mt-1">
                    <p className="text-sm font-medium text-gray-700 mb-2">Share via:</p>
                    <div className="grid grid-cols-4 gap-2">
                      <button className="flex flex-col items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-gray-600">
                        <Link size={20} />
                        <span className="text-xs mt-1">Copy Link</span>
                      </button>
                      <button className="flex flex-col items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-gray-600">
                        <Mail size={20} />
                        <span className="text-xs mt-1">Email</span>
                      </button>
                      <button className="flex flex-col items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-gray-600">
                        <Smartphone size={20} />
                        <span className="text-xs mt-1">Message</span>
                      </button>
                      <button 
                        className="flex flex-col items-center p-2 bg-gray-50 hover:bg-gray-100 rounded text-gray-600"
                        onClick={() => {
                          setCodeGenerated(false);
                          setInviteCode('');
                        }}
                      >
                        <RefreshCw size={20} />
                        <span className="text-xs mt-1">New Code</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* RAG Connect Info */}
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
              <h3 className="font-medium text-purple-800 flex items-center mb-2">
                <Shield size={16} className="mr-1" />
                About RAG Connect
              </h3>
              <p className="text-sm text-purple-700 mb-2">
                RAG Connect allows real-time collaboration between you and your friends. 
                When enabled, you'll see shared context and can collaborate on the same documents.
              </p>
              <div className="flex items-center text-sm text-purple-800">
                <Settings size={16} className="mr-1" />
                <span>Manage RAG Connect in the Friends tab</span>
                <ChevronRight size={14} className="ml-1" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsManagerPreview;