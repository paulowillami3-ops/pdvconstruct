import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../database';
import User from '../database/models/User';

type AuthContextType = {
  user: User | null;
  login: (username: string, passwordHash: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session (local storage would be used here in a real scenario)
    setIsLoading(false);
  }, []);

  const login = async (username: string, passwordHash: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const usersCollection = database.get<User>('users');
      const foundUsers = await usersCollection
        .query()
        .fetch();
      
      const foundUser = foundUsers.find(
        (u) => u.username === username && u.passwordHash === passwordHash
      );

      if (foundUser) {
        setUser(foundUser);
        setIsLoading(false);
        return true;
      }
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
