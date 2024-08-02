import React, { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Tab,
  Tabs,
  Button,
  Select,
  SelectItem,
  useDisclosure,
} from "@nextui-org/react";
import InviteModal from "./InviteModal";
import { Breadcrumbs, BreadcrumbItem } from "@nextui-org/breadcrumbs";
import { useAuth } from "@clerk/clerk-react";
import ax from "@/config/axios";
import { toast } from "sonner";
import { Member } from "@/@types/Organization";
import Role from "@/@types/Roles";


const Members: React.FC = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitedMembers, setInvitedMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const handleInvite = (newMember: Member) => {
    setInvitedMembers([...invitedMembers, newMember]);
  };

  const handleRoleChange = (index: number, newRole: string) => {
    const updatedMembers = [...members];
    updatedMembers[index].role = roles.find(
      (role) => role.name === newRole
    ) as Role;
    setMembers(updatedMembers);
  };

  const { getToken } = useAuth();
  const axios = ax(getToken);
  useEffect(() => {
    axios
      .get("organizations/settings")
      .then((res) => {
        setMembers(
          res.data.data.members.filter(
            (member: Member) => member.status === "active"
          )
        );

        setInvitedMembers(
          res.data.data.members.filter(
            (member: Member) => member.status === "pending"
          )
        );

        setRoles(res.data.data.roles);
        console.log(res.data.data.roles);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Error Fetching Settings");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="mt-5 ml-5">
        <Breadcrumbs>
          <BreadcrumbItem href={"/settings"}>Settings</BreadcrumbItem>
          <BreadcrumbItem href={"/settings/members"}>Members</BreadcrumbItem>
        </Breadcrumbs>
      </div>
      <div className="flex flex-col items-start justify-start w-full h-full p-5">
        <h1 className="text-3xl">Members</h1>
        <Tabs aria-label="Options" className="w-full pt-7" variant="underlined">
          <Tab key="members" title="Members" className="w-full">
            <Table aria-label="Members" className="w-full">
              <TableHeader>
                <TableColumn>User</TableColumn>
                <TableColumn>Joined</TableColumn>
                <TableColumn>Role</TableColumn>
              </TableHeader>
              <TableBody emptyContent={<p>No Members</p>}>
                {members.map((member, index) => (
                  <TableRow key={member.email}>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {new Date(member.addedOn).toDateString()}
                    </TableCell>
                    <TableCell>
                      <Select
                        selectedKeys={[member.role.name]}
                        onSelectionChange={(keys) =>
                          handleRoleChange(index, Array.from(keys)[0] as string)
                        }
                      >
                        {roles.map((role) => (
                          <SelectItem key={role.name} value={role.name}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tab>
          <Tab key="invite" title="Invites" className="w-full">
            <Button color="default" onPress={onOpen}>
              Invite
            </Button>
            <Table aria-label="Invited Members" className="w-full mt-4">
              <TableHeader>
                <TableColumn>User</TableColumn>
                <TableColumn>Invited</TableColumn>
                <TableColumn>Role</TableColumn>
              </TableHeader>
              <TableBody emptyContent={<p>No Invited Members</p>}>
                {invitedMembers.map((member, index) => (
                  <TableRow key={index}>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {new Date(member.addedOn).toDateString()}
                    </TableCell>
                    <TableCell>{member.role.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Tab>
        </Tabs>
        <InviteModal
          isOpen={isOpen}
          onOpenChange={onOpenChange}
          onInvite={handleInvite}
          roles={roles}
        />
      </div>
    </>
  );
};

export default Members;
