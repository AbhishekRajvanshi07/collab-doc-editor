import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listUsers()
      .then((list) => {
        setUsers(list);
        const storedId = Number(localStorage.getItem("userId"));
        const restored = list.find((u) => u.id === storedId);
        if (restored) setCurrentUser(restored);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (user) => {
    localStorage.setItem("userId", String(user.id));
    setCurrentUser(user);
  };

  const logout = () => {
    localStorage.removeItem("userId");
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ users, currentUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
