import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Si aún está cargando el AuthContext, el componente AuthProvider 
  // ya muestra el spinner global, así que aquí no deberíamos ver nada 
  // a menos que se use fuera del AuthProvider.
  if (loading) {
    return null; 
  }

  if (!isAuthenticated) {
    // Redirigir a login, guardando el intento original
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
