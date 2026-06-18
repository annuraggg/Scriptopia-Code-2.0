import {
  Call,
  StreamCall,
  StreamTheme,
  StreamVideo,
  StreamVideoClient,
  User,
} from "@stream-io/video-react-sdk";
import { useEffect, useState, useRef } from "react";
import Lobby from "./Lobby";
import Meet from "./call/Meet";
import { toast } from "sonner";
import Waiting from "./Waiting";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import Loading from "./Loading";
import { io, Socket } from "socket.io-client";
import { ExtendedMeet } from "@stypes/ExtendedMeet";

const SOCKET_URL = import.meta.env.VITE_API_URL!;
const socket: Socket = io(SOCKET_URL);

interface WaitingUser {
  id: string;
  userId: string;
}

const Main = () => {
  const streamApiKey = import.meta.env.VITE_STREAM_API_KEY;
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("lobby");

  const [serverToken, setServerToken] = useState("");
  const [_streamToken, setStreamToken] = useState("");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("guest");

  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<Call | null>(null);

  const [isReceivingCall, setIsReceivingCall] = useState(false);
  const [waitingList, setWaitingList] = useState<string[]>([]);
  const [waitingUser, setWaitingUser] = useState<WaitingUser[]>([]);

  const [meeting, setMeeting] = useState<ExtendedMeet>({} as ExtendedMeet);
  const [current, setCurrent] = useState<string>("");
  // const [isDisconnected, setIsDisconnected] = useState(false);
  ``;
  // Store pending promises to resolve them when users answer calls
  const pendingCallPromises = useRef<
    Record<
      string,
      { resolve: (value?: unknown) => void; reject: (reason?: any) => void }
    >
  >({});

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    if (role !== "interviewer") return;
    const fetchMeeting = async () => {
      const urlParams = window.location.pathname.split("/");
      const code = urlParams[urlParams.length - 1];
      axios
        .get(`/meet/${code}`)
        .then((res) => {
          console.log(res.data.data);
          setMeeting(res.data.data.meet);
        })
        .catch((err) => {
          toast.error(err.message || "An error occurred");
        });
    };

    fetchMeeting();
  }, [role]);

  useEffect(() => {
    const handleUserJoined = (data: any) => {
      if (role !== "interviewer") return;
      if (waitingList.some((obj) => obj === data.decoded.userId)) return;

      setWaitingUser((prevWaitingUser) => [
        ...prevWaitingUser,
        { id: data.socketId, userId: data.decoded.userId },
      ]);

      if (!waitingList.includes(data.decoded.userId)) {
        setWaitingList((prevWaitingList) => [
          ...prevWaitingList,
          data.decoded.userId,
        ]);
      }

      toast.info(`${data.decoded.name} has joined the meeting`);
    };

    const handleAcceptUser = (data: any) => {
      if (role !== "candidate") return;
      if (data.userId !== userId) return;

      setIsReceivingCall(true);
    };

    const handleUserLeft = (data: any) => {
      if (role !== "interviewer") return;

      const userId = waitingUser.find(
        (obj) => obj.id === data.socketId
      )?.userId;

      if (!userId) return;

      // remove all instances of the user from the waiting list
      const newWaitingUsers = waitingUser.filter(
        (obj) => obj.userId !== userId
      );
      setWaitingUser(newWaitingUsers);

      const index = waitingList.findIndex((obj) => obj === userId);
      if (index === -1) return;

      setWaitingList((prevWaitingList) => {
        const newWaitingList = [...prevWaitingList];
        newWaitingList.splice(index, 1);
        return newWaitingList;
      });
    };

    const handleUserAnsweredCall = (data: any) => {
      console.log("User answered call", data);
      if (role !== "interviewer") return;

      // Resolve the promise for this user if it exists
      if (pendingCallPromises.current[data.userId]) {
        pendingCallPromises.current[data.userId].resolve();
        delete pendingCallPromises.current[data.userId];
      }

      setWaitingList((prevWaitingList) => {
        const newWaitingList = [...prevWaitingList];
        const index = newWaitingList.findIndex((obj) => obj === data.userId);
        if (index === -1) return newWaitingList;

        newWaitingList.splice(index, 1);
        return newWaitingList;
      });

      setCurrent(data.userId);

      axios.post(`/meet/${meeting._id}/current`, { current: data.userId });
    };

    const interviewerJoined = () => {
      if (role === "interviewer") return;
      socket.emit("meet/user-joined", { token: serverToken });
    };

    socket.on("meet/user-joined/callback", handleUserJoined);
    socket.on("meet/accept-user/callback", handleAcceptUser);
    socket.on("meet/user-left/callback", handleUserLeft);
    socket.on("meet/user-answered-call/callback", handleUserAnsweredCall);
    socket.on("meet/interviewer-joined", interviewerJoined);

    return () => {
      socket.off("meet/user-joined/callback", handleUserJoined);
      socket.off("meet/accept-user/callback", handleAcceptUser);
      socket.off("meet/user-left/callback", handleUserLeft);
      socket.off("meet/user-answered-call/callback", handleUserAnsweredCall);
      socket.off("meet/interviewer-joined", interviewerJoined);
    };
  }, [role, userId, waitingList, serverToken]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const postingId = urlParams.get("id");
    axios
      .post("/meet", {
        postingId: postingId,
      })
      .then((res) => {
        setServerToken(res.data.data.token);
        setPage("lobby");
      })
      .catch((err) => {
        toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const onJoin = async () => {
    setLoading(true);
    axios
      .post("meet/stream", { token: serverToken })
      .then(async (res) => {
        setStreamToken(res.data.data.token);
        setRole(res.data.data.role);

        const { userId, name, token, role } = res.data.data;

        await setupCall(
          userId,
          name,
          token,
          role as "interviewer" | "candidate"
        );
      })
      .catch((err) => {
        toast.error(err.message || "An error occurred");
      })
      .finally(() => setLoading(false));
  };

  const joinCandidate = async () => {
    setLoading(true);
    axios
      .post("meet/stream", { token: serverToken })
      .then(async (res) => {
        setStreamToken(res.data.data.token);
        setRole(res.data.data.role);

        const { userId, name, token, role, disconnected } = res.data.data;

        await setupCall(
          userId,
          name,
          token,
          role as "interviewer" | "candidate",
          disconnected
        );
        socket.emit("meet/user-answered-call", { token: serverToken });
      })
      .catch((err) => {
        toast.error(err.message || "An error occurred");
      })
      .finally(() => setLoading(false));
  };

  const setupCall = async (
    userId: string,
    name: string,
    userToken: string,
    role: "interviewer" | "candidate",
    disconnected?: boolean
  ) => {
    setLoading(true);
    try {
      const user: User = {
        id: userId,
        type: "authenticated",
        name: name,
      };

      const newClient = new StreamVideoClient({
        apiKey: streamApiKey,
        user,
        token: userToken,
        options: { timeout: 50000 },
      });

      setClient(newClient);

      const callId = window.location.pathname.split("/")[2];
      const callType = "interview";

      if (role === "interviewer") {
        const newCall = newClient.call(callType, callId);
        await newCall.getOrCreate();
        await newCall.join();

        setCall(newCall);
        setPage("meet");

        socket.emit("meet/user-joined", { token: serverToken });
        setLoading(false);
      } else if (role === "candidate" && isReceivingCall) {
        const newCall = newClient.call(callType, callId);
        await newCall.getOrCreate();
        await newCall.join();

        setCall(newCall);
        setPage("meet");
      } else if (role === "candidate" && disconnected) {
        const newCall = newClient.call(callType, callId);
        await newCall.getOrCreate();
        await newCall.join();
      } else {
        socket.emit("meet/user-joined", { token: serverToken });
        setPage("waiting");
      }

      setUserId(userId);
    } catch (err) {
      console.error(err);
      toast.error("Failed to setup the call");
      throw err;
    }
  };

  const acceptParticipant = (userId: string) => {
    socket.emit("meet/accept-user", { userId, token: serverToken });

    const callPromise = new Promise((resolve, reject) => {
      pendingCallPromises.current[userId] = { resolve, reject };

      // Set timeout to automatically reject if the user doesn't answer
      setTimeout(() => {
        if (pendingCallPromises.current[userId]) {
          pendingCallPromises.current[userId].reject();
          delete pendingCallPromises.current[userId];
        }
      }, 30000);
    });

    toast.promise(callPromise, {
      loading: "Calling User",
      success: "User received the call",
      error: "User did not receive the call.",
    });
  };

  if (loading) return <Loading />;

  if (page === "lobby") return <Lobby onJoin={onJoin} />;

  if (!client || !call)
    return (
      <Waiting isRinging={isReceivingCall} joinInterview={joinCandidate} />
    );

  if (page === "waiting")
    return (
      <Waiting isRinging={isReceivingCall} joinInterview={joinCandidate} />
    );

  if (page === "meet")
    return (
      <StreamVideo client={client!}>
        <StreamTheme>
          <StreamCall call={call}>
            <Meet
              call={call}
              client={client}
              waitingList={waitingList}
              acceptParticipant={acceptParticipant}
              role={role}
              meeting={meeting}
              current={current}
            />
          </StreamCall>
        </StreamTheme>
      </StreamVideo>
    );
};

export default Main;
