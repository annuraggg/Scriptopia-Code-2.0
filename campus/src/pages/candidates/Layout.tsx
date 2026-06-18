import { NavLink, Outlet, useOutletContext } from "react-router-dom";
import { RootContext } from "@/types/RootContext";
import { cn } from "@/lib/utils";

const Layout = () => {
  const context = useOutletContext() as RootContext;

  const tabs = [
    { label: "Active", to: "/candidates/active" },
    { label: "Pending", to: "/candidates/pending" },
  ];

  return (
    <div>
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1440px] gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet context={context} />
    </div>
  );
};

export default Layout;
