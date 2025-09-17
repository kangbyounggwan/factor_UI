import { createContext, useContext, useState, ReactNode } from 'react';

interface AISidebarContextType {
  isCollapsed: boolean;
  width: number;
  isVisible: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setWidth: (width: number) => void;
  setIsVisible: (visible: boolean) => void;
}

const AISidebarContext = createContext<AISidebarContextType | undefined>(undefined);

export const useAISidebar = () => {
  const context = useContext(AISidebarContext);
  if (!context) {
    throw new Error('useAISidebar must be used within AISidebarProvider');
  }
  return context;
};

interface AISidebarProviderProps {
  children: ReactNode;
}

export const AISidebarProvider = ({ children }: AISidebarProviderProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [width, setWidth] = useState(384); // 24rem = 384px
  const [isVisible, setIsVisible] = useState(false);

  return (
    <AISidebarContext.Provider 
      value={{
        isCollapsed,
        width,
        isVisible,
        setIsCollapsed,
        setWidth,
        setIsVisible
      }}
    >
      {children}
    </AISidebarContext.Provider>
  );
};