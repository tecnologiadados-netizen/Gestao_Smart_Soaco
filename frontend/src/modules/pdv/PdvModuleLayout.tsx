import { Outlet } from 'react-router-dom';

export default function PdvModuleLayout() {
  return (
    <div className="pdv-module min-h-0 flex-1">
      <Outlet />
    </div>
  );
}
