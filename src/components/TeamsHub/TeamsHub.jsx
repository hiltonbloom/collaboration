import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Link,
  PlusCircle,
  Building,
  Folder,
  UserCheck,
  ArrowLeft,
  ChevronRight,
  Settings,
  Lock,
  Zap,
  Move,
  Globe,
  X,
  ArrowRightCircle
} from 'lucide-react';

// This component demonstrates a more innovative approach to teams management
// with interactive visualization, contextual actions, and fluid transitions

export default function TeamsHub() {
  const [view, setView] = useState('hub');
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [hoveredTeamId, setHoveredTeamId] = useState(null);
  const [draggingTeamId, setDraggingTeamId] = useState(null);
  const [search, setSearch] = useState('');
  const [teamPosition, setTeamPosition] = useState({});
  const [connectionLines, setConnectionLines] = useState([]);
  const [teamSize, setTeamSize] = useState({});
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [expandedSection, setExpandedSection] = useState(null);
  const [teamConnections, setTeamConnections] = useState({});
  
  // Mock data
  const teams = [
    {
      id: 1,
      name: 'Engineering',
      description: 'Core development team',
      organization: 'TechCorp Solutions',
      members: 8,
      projects: 3,
      lastActive: '2h ago',
      color: 'purple',
      connections: [2, 3],
      role: 'admin',
      icon: '💻'
    },
    {
      id: 2,
      name: 'Product',
      description: 'Product management and strategy',
      organization: 'TechCorp Solutions',
      members: 5,
      projects: 2,
      lastActive: '4h ago',
      color: 'blue',
      connections: [1, 4],
      role: 'member',
      icon: '📊'
    },
    {
      id: 3,
      name: 'Design',
      description: 'UI/UX and visual design',
      organization: 'Design Masters',
      members: 6,
      projects: 2,
      lastActive: '1d ago',
      color: 'green',
      connections: [1],
      role: 'admin',
      icon: '🎨'
    },
    {
      id: 4,
      name: 'Marketing',
      description: 'Marketing and outreach',
      organization: 'TechCorp Solutions',
      members: 4,
      projects: 1,
      lastActive: '2d ago',
      color: 'amber',
      connections: [2],
      role: 'member',
      icon: '📣'
    }
  ];
  
  const teamMembers = {
    1: [
      { id: 1, name: 'Julia Chen', role: 'Team Lead', avatar: '👩🏻‍💻', active: true },
      { id: 2, name: 'Mark Reynolds', role: 'Senior Developer', avatar: '👨🏽‍💻', active: true },
      { id: 3, name: 'Sarah Kim', role: 'Frontend Dev', avatar: '👩🏻‍💻', active: false },
      { id: 4, name: 'Alex Johnson', role: 'Backend Dev', avatar: '👨🏾‍💻', active: true }
    ],
    2: [
      { id: 5, name: 'Lisa Wong', role: 'Product Manager', avatar: '👩🏻‍💼', active: true },
      { id: 6, name: 'David Park', role: 'Product Owner', avatar: '👨🏻‍💼', active: false }
    ],
    3: [
      { id: 7, name: 'Miguel Santos', role: 'Design Lead', avatar: '👨🏽‍🎨', active: true },
      { id: 8, name: 'Emma Wilson', role: 'UI Designer', avatar: '👩🏼‍🎨', active: true }
    ]
  };
  
  const projects = {
    1: [
      { id: 101, name: 'Platform Redesign', teamsInvolved: [1, 3], status: 'In Progress' },
      { id: 102, name: 'API Overhaul', teamsInvolved: [1], status: 'Planning' }
    ],
    2: [
      { id: 201, name: 'Customer Portal', teamsInvolved: [2, 1], status: 'In Progress' }
    ],
    3: [
      { id: 301, name: 'Design System', teamsInvolved: [3, 1], status: 'Active' }
    ]
  };
  
  // Get selected team
  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  
  // Initialize team positions - normally this would be persisted
  useEffect(() => {
    // Set initial positions if not already set
    if (Object.keys(teamPosition).length === 0) {
      const centerX = window.innerWidth / 2 - 100;
      const centerY = window.innerHeight / 2 - 100;
      const radius = Math.min(window.innerWidth, window.innerHeight) * 0.25;
      
      const newPositions = {};
      teams.forEach((team, i) => {
        const angle = (i / teams.length) * 2 * Math.PI;
        newPositions[team.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        };
      });
      setTeamPosition(newPositions);
    }
    
    // Initialize team sizes based on member count
    const newSizes = {};
    teams.forEach(team => {
      newSizes[team.id] = Math.max(100, 80 + team.members * 5);
    });
    setTeamSize(newSizes);
    
    // Set initial connection lines
    updateConnectionLines();
  }, []);
  
  // Update connection lines whenever team positions change
  useEffect(() => {
    updateConnectionLines();
  }, [teamPosition, teamSize]);
  
  // Update connection lines
  const updateConnectionLines = () => {
    if (Object.keys(teamPosition).length === 0) return;
    
    const lines = [];
    teams.forEach(team => {
      const fromPos = teamPosition[team.id];
      const fromSize = teamSize[team.id] || 100;
      
      if (!fromPos) return;
      
      (team.connections || []).forEach(connectedId => {
        const toPos = teamPosition[connectedId];
        const toSize = teamSize[connectedId] || 100;
        
        if (toPos) {
          // Calculate center points
          const fromCenterX = fromPos.x + fromSize / 2;
          const fromCenterY = fromPos.y + fromSize / 2;
          const toCenterX = toPos.x + toSize / 2;
          const toCenterY = toPos.y + toSize / 2;
          
          lines.push({
            id: `${team.id}-${connectedId}`,
            from: team.id,
            to: connectedId,
            x1: fromCenterX,
            y1: fromCenterY,
            x2: toCenterX,
            y2: toCenterY,
            active: team.id === hoveredTeamId || connectedId === hoveredTeamId
          });
        }
      });
    });
    setConnectionLines(lines);
  };
  
  // Handle drag start
  const handleDragStart = (e, teamId) => {
    setDraggingTeamId(teamId);
    // Track initial mouse position
    e.dataTransfer.setData('text/plain', `${e.clientX},${e.clientY}`);
    
    // Firefox requires this
    e.dataTransfer.setDragImage(new Image(), 0, 0);
  };
  
  // Handle drag end
  const handleDragEnd = () => {
    setDraggingTeamId(null);
  };
  
  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    if (draggingTeamId) {
      const initialPos = e.dataTransfer.getData('text/plain').split(',');
      const initialX = parseFloat(initialPos[0]);
      const initialY = parseFloat(initialPos[1]);
      
      const dx = e.clientX - initialX;
      const dy = e.clientY - initialY;
      
      setTeamPosition(prev => ({
        ...prev,
        [draggingTeamId]: {
          x: (prev[draggingTeamId]?.x || 0) + dx,
          y: (prev[draggingTeamId]?.y || 0) + dy
        }
      }));
      
      e.dataTransfer.setData('text/plain', `${e.clientX},${e.clientY}`);
    }
  };
  
  // Handle team selection
  const handleSelectTeam = (teamId) => {
    setSelectedTeamId(teamId);
    setView('team-detail');
  };
  
  // Create a new team modal
  const renderCreateTeamModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in" 
           style={{animationDuration: '0.3s'}}>
        <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50">
          <h3 className="text-xl font-medium text-gray-800 mb-2">Create a New Team</h3>
          <p className="text-gray-600">Get started with a new team to collaborate with others.</p>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Enter team name"
              value={teamNameInput}
              onChange={e => setTeamNameInput(e.target.value)}
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon (optional)</label>
            <div className="flex flex-wrap gap-2">
              {['💻', '🎨', '📊', '📱', '🔍', '📝', '🚀', '📣'].map(icon => (
                <button key={icon} className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-purple-50">
                  {icon}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="1">TechCorp Solutions</option>
              <option value="2">Design Masters</option>
              <option value="new">Create New Organization...</option>
            </select>
          </div>
        </div>
        
        <div className="p-6 bg-gray-50 flex justify-end space-x-3">
          <button 
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
            onClick={() => setShowNewTeamModal(false)}>
            Cancel
          </button>
          <button 
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Create Team
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render team detail view
  const renderTeamDetail = () => {
    if (!selectedTeam) return null;
    
    // Get color class based on team color
    const getColorClass = (color) => {
      const colorMap = {
        purple: 'bg-purple-100 text-purple-800 border-purple-200',
        blue: 'bg-blue-100 text-blue-800 border-blue-200',
        green: 'bg-green-100 text-green-800 border-green-200',
        amber: 'bg-amber-100 text-amber-800 border-amber-200'
      };
      return colorMap[color] || 'bg-gray-100 text-gray-800 border-gray-200';
    };
    
    // Get active members
    const members = teamMembers[selectedTeamId] || [];
    const activeMembers = members.filter(m => m.active);
    
    // Get team projects
    const teamProjects = projects[selectedTeamId] || [];
    
    return (
      <div className="flex flex-col h-full">
        {/* Header with back button */}
        <div className="p-4 border-b border-gray-200 flex items-center">
          <button
            onClick={() => setView('hub')}
            className="mr-4 p-1.5 rounded-full hover:bg-gray-100 transition-colors duration-150"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <div className="flex items-center">
              <span className="text-2xl mr-2">{selectedTeam.icon}</span>
              <h2 className="text-lg font-medium text-gray-800">{selectedTeam.name}</h2>
              <span className={`ml-3 px-2 py-0.5 text-xs rounded-full ${getColorClass(selectedTeam.color)}`}>
                {selectedTeam.role === 'admin' ? 'Admin' : 'Member'}
              </span>
            </div>
            <div className="text-sm text-gray-500">{selectedTeam.organization} • {selectedTeam.members} members</div>
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Team pulse - activity visualization */}
          <div className="p-6">
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-3">Team Pulse</h3>
              <div className="bg-white border border-gray-200 rounded-2xl p-6 overflow-hidden">
                <div className="flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    {/* Animated pulse circle */}
                    <div className={`absolute inset-0 rounded-full bg-${selectedTeam.color}-50 animate-pulse opacity-20`}></div>
                    <div className={`absolute inset-4 rounded-full bg-${selectedTeam.color}-100 animate-pulse opacity-30`} style={{animationDelay: '0.2s'}}></div>
                    <div className={`absolute inset-8 rounded-full bg-${selectedTeam.color}-200 animate-pulse opacity-40`} style={{animationDelay: '0.4s'}}></div>
                    
                    {/* Center content */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-6xl mb-2">{selectedTeam.icon}</div>
                      <div className="font-medium">{selectedTeam.members} members</div>
                      <div className="text-sm text-gray-500">Last active: {selectedTeam.lastActive}</div>
                    </div>
                    
                    {/* Active members around the circle */}
                    {activeMembers.map((member, i) => {
                      const angle = (i / activeMembers.length) * 2 * Math.PI;
                      const x = 110 * Math.cos(angle);
                      const y = 110 * Math.sin(angle);
                      
                      return (
                        <div 
                          key={member.id}
                          className="absolute w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-md"
                          style={{
                            transform: `translate(${x + 122}px, ${y + 122}px)`,
                            zIndex: 10
                          }}
                        >
                          <span className="text-lg">{member.avatar}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Expandable sections */}
            <div className="space-y-4">
              {/* Members section */}
              <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out ${expandedSection === 'members' ? 'max-h-96' : 'max-h-20'}`}>
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSection(expandedSection === 'members' ? null : 'members')}
                >
                  <div className="flex items-center">
                    <Users size={20} className="text-purple-600 mr-3" />
                    <h3 className="font-medium text-gray-800">Team Members</h3>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">{members.length} members</span>
                    <ChevronRight 
                      size={18} 
                      className={`text-gray-400 transition-transform duration-300 ${expandedSection === 'members' ? 'transform rotate-90' : ''}`} 
                    />
                  </div>
                </div>
                
                {expandedSection === 'members' && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      {members.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-3">
                              <span className="text-xl">{member.avatar}</span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{member.name}</div>
                              <div className="text-sm text-gray-500">{member.role}</div>
                            </div>
                          </div>
                          <div className="flex items-center">
                            {member.active && (
                              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 text-xs mr-2">Active</span>
                            )}
                            <button className={`p-1.5 rounded-full hover:bg-${selectedTeam.color}-100`}>
                              <Settings size={16} className="text-gray-500" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      <button className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-center hover:bg-gray-50 text-purple-600 flex items-center justify-center">
                        <UserPlus size={16} className="mr-2" />
                        <span>Add New Member</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Projects section */}
              <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out ${expandedSection === 'projects' ? 'max-h-96' : 'max-h-20'}`}>
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSection(expandedSection === 'projects' ? null : 'projects')}
                >
                  <div className="flex items-center">
                    <Folder size={20} className="text-blue-600 mr-3" />
                    <h3 className="font-medium text-gray-800">Projects</h3>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">{teamProjects.length} projects</span>
                    <ChevronRight 
                      size={18} 
                      className={`text-gray-400 transition-transform duration-300 ${expandedSection === 'projects' ? 'transform rotate-90' : ''}`} 
                    />
                  </div>
                </div>
                
                {expandedSection === 'projects' && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      {teamProjects.map(project => (
                        <div key={project.id} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-800">{project.name}</div>
                            <span className={`px-2 py-0.5 rounded-full text-xs 
                              ${project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 
                                project.status === 'Planning' ? 'bg-amber-100 text-amber-800' : 
                                'bg-green-100 text-green-800'}`}>
                              {project.status}
                            </span>
                          </div>
                          
                          <div className="mt-2 flex items-center">
                            <div className="text-sm text-gray-500 mr-2">Teams:</div>
                            <div className="flex -space-x-2">
                              {project.teamsInvolved.map(teamId => {
                                const team = teams.find(t => t.id === teamId);
                                return (
                                  <div 
                                    key={teamId} 
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs 
                                      ${teamId === selectedTeamId ? 
                                        `bg-${selectedTeam.color}-200 border-2 border-white` : 
                                        'bg-gray-200 border border-white'}`}
                                  >
                                    {team?.icon || teamId}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <button className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-center hover:bg-gray-50 text-blue-600 flex items-center justify-center">
                        <PlusCircle size={16} className="mr-2" />
                        <span>Create New Project</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Connected Teams section */}
              <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out ${expandedSection === 'connections' ? 'max-h-96' : 'max-h-20'}`}>
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSection(expandedSection === 'connections' ? null : 'connections')}
                >
                  <div className="flex items-center">
                    <Link size={20} className="text-green-600 mr-3" />
                    <h3 className="font-medium text-gray-800">Connected Teams</h3>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">{selectedTeam.connections?.length || 0} connections</span>
                    <ChevronRight 
                      size={18} 
                      className={`text-gray-400 transition-transform duration-300 ${expandedSection === 'connections' ? 'transform rotate-90' : ''}`} 
                    />
                  </div>
                </div>
                
                {expandedSection === 'connections' && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      {(selectedTeam.connections || []).map(connId => {
                        const team = teams.find(t => t.id === connId);
                        if (!team) return null;
                        
                        return (
                          <div key={team.id} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer"
                            onClick={() => handleSelectTeam(team.id)}>
                            <div className="flex items-center">
                              <div className={`w-10 h-10 rounded-full bg-${team.color}-100 flex items-center justify-center mr-3`}>
                                <span className="text-xl">{team.icon}</span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-800">{team.name}</div>
                                <div className="text-sm text-gray-500">{team.organization}</div>
                              </div>
                              <ArrowRightCircle size={18} className="ml-auto text-gray-400" />
                            </div>
                          </div>
                        );
                      })}
                      
                      <button className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-center hover:bg-gray-50 text-green-600 flex items-center justify-center">
                        <Link size={16} className="mr-2" />
                        <span>Connect with Another Team</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Settings section */}
              <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out ${expandedSection === 'settings' ? 'max-h-96' : 'max-h-20'}`}>
                <div 
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedSection(expandedSection === 'settings' ? null : 'settings')}
                >
                  <div className="flex items-center">
                    <Settings size={20} className="text-gray-600 mr-3" />
                    <h3 className="font-medium text-gray-800">Team Settings</h3>
                  </div>
                  <ChevronRight 
                    size={18} 
                    className={`text-gray-400 transition-transform duration-300 ${expandedSection === 'settings' ? 'transform rotate-90' : ''}`} 
                  />
                </div>
                
                {expandedSection === 'settings' && (
                  <div className="px-4 pb-4">
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-between">
                        <div className="flex items-center">
                          <Globe size={18} className="text-gray-600 mr-3" />
                          <span>Visibility</span>
                        </div>
                        <select className="border border-gray-300 rounded-md px-2 py-1 text-sm">
                          <option>Organization</option>
                          <option>Public</option>
                          <option>Private</option>
                        </select>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-between">
                        <div className="flex items-center">
                          <Lock size={18} className="text-gray-600 mr-3" />
                          <span>Permissions</span>
                        </div>
                        <button className="px-2 py-1 text-sm text-purple-600 border border-purple-200 rounded-md hover:bg-purple-50">
                          Configure
                        </button>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-between">
                        <div className="flex items-center">
                          <Zap size={18} className="text-gray-600 mr-3" />
                          <span>Integrations</span>
                        </div>
                        <button className="px-2 py-1 text-sm text-purple-600 border border-purple-200 rounded-md hover:bg-purple-50">
                          Manage
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render hub view with interactive team visualization
  const renderHub = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="text-lg font-medium text-gray-800">Team Space</h2>
        
        <div className="flex items-center">
          <div className="relative mx-2">
            <input
              type="text"
              placeholder="Search teams..."
              className="w-64 pl-9 pr-4 py-2 border border-gray-300 rounded-full text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            {search && (
              <button
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                onClick={() => setSearch('')}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <button 
            className="ml-2 px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 flex items-center"
            onClick={() => setShowNewTeamModal(true)}
          >
            <PlusCircle size={16} className="mr-2" />
            <span>New Team</span>
          </button>
        </div>
      </div>
      
      {/* Interactive visualization area */}
      <div 
        className="flex-1 overflow-hidden relative bg-gradient-to-br from-gray-50 to-white"
        onDragOver={handleDragOver}
      >
        {/* Connection lines between teams */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          {connectionLines.map(line => (
            <line
              key={line.id}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.active ? "#6366f1" : "#e5e7eb"}
              strokeWidth={line.active ? 3 : 2}
              strokeDasharray={line.active ? "none" : "5,5"}
              className="transition-all duration-300"
            />
          ))}
        </svg>
        
        {/* Teams visualization */}
        <div className="relative w-full h-full">
          {teams.map(team => {
            const pos = teamPosition[team.id] || { x: 100, y: 100 };
            const size = teamSize[team.id] || 100;
            
            // Get color class based on team color
            const getColorClass = (baseColor) => {
              return {
                bg: `bg-${baseColor}-100`,
                border: `border-${baseColor}-200`,
                hoverBg: `hover:bg-${baseColor}-200`,
                text: `text-${baseColor}-800`
              };
            };
            
            const colorClass = getColorClass(team.color);
            
            return (
              <div
                key={team.id}
                className={`absolute rounded-xl ${colorClass.bg} ${colorClass.border} ${colorClass.hoverBg} border-2 shadow-lg cursor-move transition-all duration-300 overflow-hidden
                  ${hoveredTeamId === team.id ? 'ring-2 ring-purple-400 shadow-xl z-10' : 'z-0'}
                  ${draggingTeamId === team.id ? 'opacity-70' : 'opacity-100'}`}
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transition: draggingTeamId === team.id ? 'none' : 'all 0.3s ease'
                }}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, team.id)}
                onDragEnd={handleDragEnd}
                onMouseEnter={() => setHoveredTeamId(team.id)}
                onMouseLeave={() => setHoveredTeamId(null)}
                onClick={() => handleSelectTeam(team.id)}
              >
                <div className="p-4 h-full flex flex-col">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">{team.icon}</span>
                    <div className="font-medium">{team.name}</div>
                    {team.role === 'admin' && (
                      <span className="ml-auto text-xs bg-white bg-opacity-70 rounded-full px-2 py-0.5 text-purple-800">Admin</span>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="text-xs text-gray-600 truncate">{team.organization}</div>
                    
                    <div className="mt-3 flex items-center space-x-2">
                      <div className="flex items-center">
                        <Users size={14} className="text-gray-500 mr-1" />
                        <span className="text-xs">{team.members}</span>
                      </div>
                      <div className="flex items-center">
                        <Folder size={14} className="text-gray-500 mr-1" />
                        <span className="text-xs">{team.projects}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>Last active: {team.lastActive}</span>
                    <Move size={14} className="text-gray-400" />
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Hint text when visualization is empty */}
          {teams.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md p-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-purple-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">No teams yet</h3>
                <p className="text-gray-500 mb-4">
                  Teams help you organize people and projects. Drag teams to arrange them and
                  create connections between related teams.
                </p>
                <button
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  onClick={() => setShowNewTeamModal(true)}
                >
                  Create Your First Team
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-3 rounded-lg border border-gray-200 text-xs text-gray-600">
          <div className="flex items-center mb-1">
            <div className="w-3 h-3 rounded-full bg-purple-100 border border-purple-200 mr-2"></div>
            <span>Your team (admin)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-200 mr-2"></div>
            <span>Teams you're a member of</span>
          </div>
          <div className="mt-2 text-gray-500">
            <span>Tip: Drag teams to rearrange</span>
          </div>
        </div>
      </div>
    </div>
  );
  
  // Main render
  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {view === 'hub' ? renderHub() : renderTeamDetail()}
      
      {/* Team creation modal */}
      {showNewTeamModal && renderCreateTeamModal()}
    </div>
  );
}