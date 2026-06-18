import { useMemo, useState } from "react";
import { Button, Input, Tab, Tabs } from "@heroui/react";
import {
  Activity,
  Building2,
  KeyRound,
  Laptop,
  Link2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import ax from "@/config/axios";
import { useAuth } from "@/auth";

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="border-b border-slate-200 py-7 last:border-b-0">
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  </section>
);

const Settings = () => {
  const { user, getToken, refreshUser, signOut } = useAuth();
  const api = useMemo(() => ax(getToken), [getToken]);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [imageUrl, setImageUrl] = useState(user?.imageUrl || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const memberships = [
    user?.publicMetadata?.organization
      ? { type: "Organization", ...user.publicMetadata.organization }
      : null,
    user?.publicMetadata?.institute
      ? { type: "Institute", ...user.publicMetadata.institute }
      : null,
  ].filter(Boolean) as any[];

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.patch("/users/auth/profile", { firstName, lastName, imageUrl });
      await refreshUser();
      toast.success("Profile updated");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    try {
      await api.post("/users/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated and other sessions revoked");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    await api.delete(`/users/auth/sessions/${sessionId}`);
    await refreshUser();
    toast.success("Session revoked");
  };

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 text-slate-950 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-200 pb-6">
          <p className="text-sm font-medium text-slate-500">Identity and access</p>
          <h1 className="mt-1 text-3xl font-semibold">Account workspace</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Manage your profile, credentials, active sessions, memberships, roles,
            permissions, and account activity.
          </p>
        </header>

        <Tabs
          aria-label="Account workspace"
          variant="underlined"
          classNames={{ tabList: "mt-4 gap-6", panel: "p-0" }}
        >
          <Tab key="profile" title={<span className="flex items-center gap-2"><UserRound className="h-4 w-4" />Profile</span>}>
            <Section title="Profile" description="Identity details visible across Scriptopia products.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="First name" value={firstName} onValueChange={setFirstName} />
                <Input label="Last name" value={lastName} onValueChange={setLastName} />
                <Input className="sm:col-span-2" label="Email" value={user?.email || ""} isReadOnly />
                <Input className="sm:col-span-2" label="Avatar URL" value={imageUrl} onValueChange={setImageUrl} />
                <div className="sm:col-span-2">
                  <Button color="primary" onPress={saveProfile} isLoading={saving}>Save profile</Button>
                </div>
              </div>
            </Section>
            <Section title="Connected accounts" description="Authentication methods linked to this identity.">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-slate-500" />
                  <div><p className="text-sm font-medium">Email and password</p><p className="text-xs text-slate-500">{user?.email}</p></div>
                </div>
                <span className="text-xs font-medium text-emerald-700">Active</span>
              </div>
            </Section>
          </Tab>

          <Tab key="security" title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Security</span>}>
            <Section title="Password" description="Use at least eight characters. Updating it signs out other devices.">
              <div className="max-w-lg space-y-4">
                <Input label="Current password" type="password" value={currentPassword} onValueChange={setCurrentPassword} startContent={<LockKeyhole className="h-4 w-4" />} />
                <Input label="New password" type="password" value={newPassword} onValueChange={setNewPassword} startContent={<KeyRound className="h-4 w-4" />} />
                <Button color="primary" onPress={changePassword} isLoading={saving}>Update password</Button>
              </div>
            </Section>
            <Section title="Active sessions" description="Devices currently authorized to access your account.">
              <div className="space-y-3">
                {(user?.sessions || []).map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Laptop className="h-5 w-5 shrink-0 text-slate-500" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{session.userAgent || "Unknown device"}</p>
                        <p className="text-xs text-slate-500">{session.ipAddress || "Private network"} · {new Date(session.lastSeenAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="bordered" color="danger" onPress={() => revokeSession(session.id)}>Revoke</Button>
                  </div>
                ))}
              </div>
            </Section>
          </Tab>

          <Tab key="access" title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4" />Access</span>}>
            <Section title="Memberships" description="Workspaces and institutions associated with your identity.">
              <div className="space-y-3">
                {memberships.length ? memberships.map((membership) => (
                  <div key={`${membership.type}-${membership._id}`} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="text-sm font-semibold">{membership.name}</p><p className="text-xs text-slate-500">{membership.type}</p></div>
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium">{membership.role?.name || membership.role?.slug}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(membership.role?.permissions || []).map((permission: string) => (
                        <span key={permission} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">{permission}</span>
                      ))}
                    </div>
                  </div>
                )) : <p className="text-sm text-slate-500">No organization memberships.</p>}
              </div>
            </Section>
          </Tab>

          <Tab key="activity" title={<span className="flex items-center gap-2"><Activity className="h-4 w-4" />Activity</span>}>
            <Section title="Login history" description="Recent successful access to your account.">
              <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
                {(user?.loginHistory || []).map((event: any, index: number) => (
                  <div key={`${event.at}-${index}`} className="grid gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_180px_120px]">
                    <span className="truncate">{event.userAgent || "Unknown device"}</span>
                    <span className="text-slate-500">{event.ipAddress || "Private network"}</span>
                    <span className="text-slate-500">{new Date(event.at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </Section>
            <Section title="Account actions" description="End the current session on this device.">
              <Button color="danger" variant="bordered" onPress={() => signOut()}>Sign out</Button>
            </Section>
          </Tab>
        </Tabs>
      </div>
    </main>
  );
};

export default Settings;
