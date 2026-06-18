import { Outlet, useOutletContext } from "react-router-dom";
import Sidebar from "./Sidebar";
import { RootContext } from "@/types/RootContext";
import { useEffect, useState } from "react";
import UnsavedToast from "@/components/UnsavedToast";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast as sonner } from "sonner";
import { OrganizationWithPostings as OWP } from "@/types/RootContext";

const Layout = () => {
  const { organization, setOrganization, user } =
    useOutletContext() as RootContext;

  const [toast, setToast] = useState<boolean>(false);
  const [shakeToast, setShakeToast] = useState<boolean>(false);
  const [rerender, setRerender] = useState<boolean>(false);
  const [newOrganization, setNewOrganization] = useState<OWP>({} as OWP);

  useEffect(() => {
    setNewOrganization(organization);
    setRerender(!rerender);
  }, [organization]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const action = () => {
    setToast(false);
    console.log(newOrganization);
    axios
      .put("organizations", newOrganization)
      .then(() => {
        setOrganization(newOrganization);
        sonner.success("Saved", { position: "top-right" });
      })
      .catch((err) => {
        sonner.error("Error updating organization. Please try again.");
        console.error(err);
      });
  };

  const reset = () => {
    setToast(false);
    setNewOrganization(organization);
    setRerender(!rerender);
  };

  const handleToast = (toast: boolean, newOrganization?: OWP) => {
    setToast(toast);
    if (newOrganization) setNewOrganization(newOrganization);
  };

  const updateLocalOrganization = (newOrganization: OWP) => {
    setNewOrganization(newOrganization);
    setToast(true);
  };

  return (
    <div className="">
      <div className="flex w-full">
        <Sidebar toast={toast} shakeToast={setShakeToast} />
        <div className="h-full w-full overflow-x-auto">
          <Outlet
            context={{
              organization: newOrganization,
              setOrganization: updateLocalOrganization,
              setToast: handleToast,
              toast,
              rerender,
              user,
            }}
          />
        </div>
        {toast && (
          <UnsavedToast action={action} reset={reset} shake={shakeToast} />
        )}
      </div>
    </div>
  );
};

export default Layout;
