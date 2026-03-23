import { useAuth } from "@/App";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Zap,
  LayoutDashboard,
  Database,
  Calculator,
  Thermometer,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Sidebar = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard", path: "/dashboard" },
    { icon: <Database className="w-5 h-5" />, label: "Cable Library", path: "/cables" },
    { icon: <Calculator className="w-5 h-5" />, label: "New Calculation", path: "/calculate" },
    { icon: <Thermometer className="w-5 h-5" />, label: "DTR Analysis", path: "/calculate?method=c57_91_2011" },
  ];

  const isActive = (path) => {
    const [pathPart, queryPart] = path.split('?');
    if (queryPart) {
      return location.pathname === pathPart && location.search === `?${queryPart}`;
    }
    return (location.pathname === pathPart || location.pathname.startsWith(pathPart + '/')) && !location.search;
  };

  return (
    <div className="min-h-screen bg-zinc-950 grid-background">
      {/* Sidebar */}
      <aside className={`sidebar transition-all duration-300 ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-black" />
            </div>
            {!collapsed && (
              <span className="font-mono font-bold text-white whitespace-nowrap">Thermal Tools</span>
            )}
          </div>
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-zinc-500 hover:text-cyan-400 transition-colors"
            data-testid="sidebar-toggle"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="py-4 flex-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`sidebar-item w-full ${isActive(item.path) ? 'active' : ''}`}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              {item.icon}
              {!collapsed && <span className="text-sm">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-zinc-800">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                data-testid="user-menu-trigger"
              >
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="bg-cyan-500/20 text-cyan-400">
                    {user?.name?.charAt(0) || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="text-left overflow-hidden">
                    <div className="text-sm text-white truncate">{user?.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{user?.email}</div>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-zinc-900 border-zinc-800">
              <DropdownMenuItem className="text-zinc-400">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem 
                onClick={logout}
                className="text-red-400 focus:text-red-400"
                data-testid="logout-btn"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content transition-all duration-300 ${collapsed ? 'main-content-collapsed' : ''}`}>
        {children}
      </main>
    </div>
  );
};

export default Sidebar;
