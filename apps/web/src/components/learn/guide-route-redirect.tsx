import { Navigate, useLocation } from 'react-router-dom';

export function GuideRouteRedirect() {
  const { hash } = useLocation();
  return <Navigate to={{ pathname: '/learn', search: '?tab=guide', hash }} replace />;
}
