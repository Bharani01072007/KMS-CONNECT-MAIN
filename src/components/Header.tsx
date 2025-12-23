import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/logo.jpg';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
  showMenu?: boolean;
  backTo?: string;
  rightAction?: ReactNode;
}

const Header = ({ title, onMenuClick, showMenu = false, backTo, rightAction }: HeaderProps) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {backTo && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(backTo)}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {showMenu && !backTo && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onMenuClick}
              className="lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <img 
            src={logo} 
            alt="KMS Logo" 
            style={{ width: 208, height: 66 }}
            className="object-contain"
          />
          <div>
            <h1 className="font-semibold text-foreground">{title}</h1>
            {user?.email && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {user.email}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {rightAction}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
