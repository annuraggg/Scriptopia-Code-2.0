import { Outlet, useOutletContext } from "react-router-dom";
import Sidebar from "./Sidebar";
import { RootContext } from "@/types/RootContext";
import { useEffect, useState } from "react";
import UnsavedToast from "@/components/UnsavedToast";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast as sonner } from "sonner";
import { ExtendedInstitute } from "@shared-types/ExtendedInstitute";

const Layout = () => {
  const { institute, setInstitute, user } = useOutletContext() as RootContext;

  const [toast, setToast] = useState<boolean>(false);
  const [shakeToast, setShakeToast] = useState<boolean>(false);
  const [rerender, setRerender] = useState<boolean>(false);
  const [newInstitute, setNewInstitute] = useState<ExtendedInstitute>(
    {} as ExtendedInstitute
  );

  useEffect(() => {
    setNewInstitute(institute);
    setRerender(!rerender);
  }, [institute]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const action = () => {
    setToast(false);
    console.log(newInstitute);
    axios
      .put("institutes", newInstitute)
      .then(() => {
        setInstitute(newInstitute);
        sonner.success("Saved", { position: "top-right" });
      })
      .catch((err) => {
        sonner.error("Error updating institute. Please try again.");
        console.error(err);
      });
  };

  const reset = () => {
    setToast(false);
    setNewInstitute(institute);
    setRerender(!rerender);
  };

  const handleToast = (toast: boolean, newInstitute?: ExtendedInstitute) => {
    setToast(toast);
    if (newInstitute) setNewInstitute(newInstitute);
  };

  const updateLocalInstitute = (newInstitute: ExtendedInstitute) => {
    setNewInstitute(newInstitute);
    setToast(true);
  };

  return (
    <div className="">
      <div className="flex w-full">
        <Sidebar toast={toast} shakeToast={setShakeToast} />
        <div className="h-full w-full overflow-x-auto">
          <Outlet
            context={{
              institute: newInstitute,
              setInstitute: updateLocalInstitute,
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
