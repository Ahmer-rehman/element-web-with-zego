/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

PDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, useEffect } from "react";
import { Body as BodyText, Button, IconButton, Tooltip } from "@vector-im/compound-web";
import VideoCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/video-call-solid";
import VoiceCallIcon from "@vector-im/compound-design-tokens/assets/web/icons/voice-call";
import RoomInfoIcon from "@vector-im/compound-design-tokens/assets/web/icons/info-solid";
import NotificationsIcon from "@vector-im/compound-design-tokens/assets/web/icons/notifications-solid";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";
import PublicIcon from "@vector-im/compound-design-tokens/assets/web/icons/public";
import { JoinRule, type Room } from "matrix-js-sdk/src/matrix";
import { ViewRoomOpts } from "@matrix-org/react-sdk-module-api/lib/lifecycles/RoomViewLifecycle";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { ZIM } from "zego-zim-web";
import { useRoomName } from "../../../../hooks/useRoomName.ts";
import { RightPanelPhases } from "../../../../stores/right-panel/RightPanelStorePhases.ts";
import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext.tsx";
import { useRoomMemberCount, useRoomMembers } from "../../../../hooks/useRoomMembers.ts";
import { _t } from "../../../../languageHandler.tsx";
import { Flex } from "../../../utils/Flex.tsx";
import { Box } from "../../../utils/Box.tsx";
import { useGlobalNotificationState } from "../../../../hooks/useGlobalNotificationState.ts";
import { useFeatureEnabled } from "../../../../hooks/useSettings.ts";
import { useEncryptionStatus } from "../../../../hooks/useEncryptionStatus.ts";
import { E2EStatus } from "../../../../utils/ShieldUtils.ts";
import FacePile from "../../elements/FacePile.tsx";
import { useRoomState } from "../../../../hooks/useRoomState.ts";
import RoomAvatar from "../../avatars/RoomAvatar.tsx";
import { formatCount } from "../../../../utils/FormattingUtils.ts";
import RightPanelStore from "../../../../stores/right-panel/RightPanelStore.ts";
import { RoomKnocksBar } from "../RoomKnocksBar.tsx";
import { notificationLevelToIndicator } from "../../../../utils/notifications.ts";
import { ButtonEvent } from "../../elements/AccessibleButton.tsx";
import WithPresenceIndicator, { useDmMember } from "../../avatars/WithPresenceIndicator.tsx";
import { IOOBData } from "../../../../stores/ThreepidInviteStore.ts";
import defaultDispatcher from "../../../../dispatcher/dispatcher.ts";
import { RoomSettingsTab } from "../../dialogs/RoomSettingsDialog.tsx";
import { ToggleableIcon } from "./toggle/ToggleableIcon.tsx";
import { CurrentRightPanelPhaseContextProvider } from "../../../../contexts/CurrentRightPanelPhaseContext.tsx";
import { getFirestore, collection, addDoc, doc, getDocs, setDoc, initializeFirestore } from "firebase/firestore";
import { initializeApp } from "firebase/app";

export default function RoomHeader({
    room,
    oobData,
}: {
    room: Room;
    additionalButtons?: ViewRoomOpts["buttons"];
    oobData?: IOOBData;
}): JSX.Element {
    const client = useMatrixClientContext();
    const roomName = useRoomName(room);
    const joinRule = useRoomState(room, (state) => state.getJoinRule());
    const members = useRoomMembers(room, 2500);
    const memberCount = useRoomMemberCount(room, { throttleWait: 2500 });
    const globalNotificationState = useGlobalNotificationState();

    // Define a type for our members to be stored in state.
    type Member = {
        membership?: string;
        roomId: string;
        userId: string;
        rawDisplayName: string;
        imgurl: string | null;
    };
    type User = {
        userName: string;
        img: string;
        userID: string;
    };

    /**
     * Logs call details to Firestore under:
     * calllogs/{currentUserId}/calls/{docId}
     *
     * If the parent document (calllogs/{currentUserId}) does not exist, it creates one.
     *
     * @param isIncoming - Indicates if the call is incoming.
     * @param isVideo - Indicates if the call is a video call.
     * @param isMissed - Indicates if the call was missed.
     * @param currentUserDisplayName - The caller's display name.
     * @param currentUserId - The caller's user ID.
     * @param userList - An array of callee objects.
     *                   Each object is expected to have at least:
     *                      - userID: string
     *                      - userName: string
     *                      - img: string (the callee's image URL)
     * @param roomId - The room ID where the call was initiated.
     */

    const dmMember = useDmMember(room);
    const isDirectMessage = !!dmMember;
    const e2eStatus = useEncryptionStatus(client, room);
    const appid = 1146553792;
    const serversecret = "804182900b0b2337d9bfa362b3630ace";

    const firebaseConfig = {
        apiKey: "AIzaSyDz9uiR4jtthJQ3oXRBtDGF3RTGF9sUOjE",
        authDomain: "beep-7a8b4.firebaseapp.com",
        projectId: "beep-7a8b4",
        storageBucket: "beep-7a8b4.firebasestorage.app",
        messagingSenderId: "264530976033",
        appId: "1:264530976033:web:a50c0faa52dbd7c3abb260",
    };
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const notificationsEnabled = useFeatureEnabled("feature_notifications");
    const askToJoinEnabled = useFeatureEnabled("feature_ask_to_join");
    const [otherMembers, setOtherMembers] = useState<Member[]>([]);
    const [zp, setZp] = useState<any>(null);

    // Remove unwanted characters from the user ID.
    const cleanUserId = (id: string): string => {
        console.log("Original ID before cleaning:", id);
        const cleanedId = id.replace(/[^a-zA-Z0-9]/g, "");
        console.log("Cleaned ID:", cleanedId);
        return cleanedId;
    };

    // Convert a Matrix MXC URL to an HTTP URL.
    // See: [Matrix Client-Server API Documentation](https://matrix.org/docs/spec/client_server/latest#retrieving-media)
    const convertMxcUrlToHttp = (mxcUrl: string | null): string | null => {
        if (!mxcUrl) return null;
        if (mxcUrl.startsWith("mxc://")) {
            // Remove "mxc://" and split into server and media ID.
            const parts = mxcUrl.substring(6).split("/");
            if (parts.length >= 2) {
                const server = parts[0];
                const mediaId = parts[1];
                // Replace with your Matrix homeserver URL.
                return `mxc://ms.beep.gov.pk/_matrix/media/r0/download/${server}/${mediaId}`;
            }
        }
        return mxcUrl;
    };

    // Initialize Zego UI Kit on mount.
    useEffect(() => {
        init();
    }, []);

    function init() {
        // Retrieve the current user details from localStorage.
        const temp = localStorage.getItem("mx_user_id") || "";
        const currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";
        const currentUserId = temp ? cleanUserId(temp) : "";
        console.log("my ids", currentUserId, currentUserDisplayName);
        if (!currentUserId || !currentUserDisplayName) {
            console.error("Error: Missing User ID or Display Name in localStorage.");
            return;
        }

        try {
            const KitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                appid,
                serversecret,
                room.roomId,
                currentUserId, // Use the cleaned userId.
                currentUserDisplayName,
            );
            if (!KitToken) {
                console.error("Failed to generate Kit Token.");
                return;
            }
            const zegoInstance = ZegoUIKitPrebuilt.create(KitToken);
            zegoInstance.addPlugins({ ZIM });
            zegoInstance.setCallInvitationConfig({
                ringtoneConfig: {
                    incomingCallUrl:
                        "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ring.ogg?alt=media&token=f7ff8103-a1e5-42a6-a7d3-12c73b5bda2e",
                    outgoingCallUrl:
                        "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ringback.ogg?alt=media&token=308068d4-a9af-4b1f-a4da-d8cc1f237685",
                },
            });
            setZp(zegoInstance);
            console.log("Zego UI Kit initialized successfully with ZIM plugin.");
            localStorage.setItem("initialized", "true");
        } catch (error) {
            console.error("Error initializing Zego UI Kit:", error);
        }
    }

    // Filter and update members, excluding the current user.
    useEffect(() => {
        const tempId = localStorage.getItem("mx_user_id");
        const currentUserDisplayName = localStorage.getItem("mx_profile_displayname");
        const currentUserAvatar = localStorage.getItem("mx_user_avatar");

        console.log("Temp ID from localStorage:", tempId);
        console.log("Current User Display Name from localStorage:", currentUserDisplayName);
        console.log("Current User Avatar from localStorage:", currentUserAvatar);

        const currentUserId = tempId ? cleanUserId(tempId) : "";
        const currentUserDisplayNameCleaned = currentUserDisplayName ? currentUserDisplayName.trim() : "";

        console.log("Cleaned User ID:", currentUserId);
        console.log("Cleaned Display Name:", currentUserDisplayNameCleaned);

        // Filter out the current user and then map each member to include an `imgurl` property.
        const filteredMembers = members
            .filter((member) => {
                const cleanedUserId = member.userId ? cleanUserId(member.userId) : "";
                const cleanedDisplayName = member.rawDisplayName ? member.rawDisplayName.trim() : "";
                const img = member.user?.avatarUrl || member.imgurl || null;
                console.log("Member User ID (cleaned):", cleanedUserId);
                console.log("Member Display Name (cleaned):", cleanedDisplayName);
                console.log("Member Avatar URL:", img);
                return !(
                    cleanedUserId === currentUserId &&
                    cleanedDisplayName === currentUserDisplayNameCleaned &&
                    currentUserAvatar === img
                );
            })
            .map((member) => {
                const img = member.user?.avatarUrl || member.imgurl || null;
                return { ...member, imgurl: img };
            });

        console.log("Filtered Members (excluding current user):", filteredMembers);
        setOtherMembers(filteredMembers);
    }, [members]);

    // Group call function for voice calls.
    function GroupCallVoice() {
        const currentUserId = localStorage.getItem("mx_user_id") || "";
        const currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";

        if (!zp) {
            console.error("Zego UI Kit is not initialized yet.");
            return;
        }

        // Prepare the target users for the invitation.
        const targetUsers = otherMembers.map((member) => {
            const cleanedUserId = cleanUserId(member.userId);
            console.log(`Preparing invitation for User: ${member.rawDisplayName} (ID: ${cleanedUserId})`);
            return {
                userID: cleanedUserId,
                userName: member.rawDisplayName,
            };
        });
        // Map users for call logging, including the image URL conversion.
        const targetUserc = otherMembers.map((member) => ({
            userID: member.userId,
            userName: member.rawDisplayName,
            roomid: room.roomId,
            img: convertMxcUrlToHttp(member.imgurl),
        }));

        const isIncoming = false; // Outgoing call.
        const isVideo = false; // Audio call.
        const isMissed = false; // Not a missed call.

        zp.sendCallInvitation({
            callees: targetUsers,
            callType: ZegoUIKitPrebuilt.InvitationTypeVoiceCall,
            timeout: 60,
        })
            .then((res: any) => {
                console.warn("Group invitation sent successfully.", res);
                // Log call details.
                calllog(isIncoming, isVideo, isMissed, currentUserDisplayName, currentUserId, targetUserc, room.roomId);
            })
            .catch((err: any) => {
                console.error("Error sending group invitation:", err);
            });
    }

    // Group call function for video calls.
    function GroupCallVideo() {
        const currentUserId = localStorage.getItem("mx_user_id") || "";
        const currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";

        if (!zp) {
            console.error("Zego UI Kit is not initialized yet.");
            return;
        }

        // Prepare the target users for the invitation.
        const targetUsers = otherMembers.map((member) => {
            const cleanedUserId = cleanUserId(member.userId);
            console.log(`Preparing invitation for User: ${member.rawDisplayName} (ID: ${cleanedUserId})`);
            return {
                userID: cleanedUserId,
                userName: member.rawDisplayName,
            };
        });
        // Map users for call logging, including the image URL conversion.
        const targetUserc = otherMembers.map((member) => ({
            userID: member.userId,
            userName: member.rawDisplayName,
            roomid: room.roomId,
            img: convertMxcUrlToHttp(member.imgurl),
        }));

        const isIncoming = false; // Outgoing call.
        const isVideo = true; // Video call.
        const isMissed = false; // Not a missed call.

        zp.sendCallInvitation({
            callees: targetUsers,
            callType: ZegoUIKitPrebuilt.InvitationTypeVideoCall,
            timeout: 60,
        })
            .then((res: any) => {
                console.warn("Group invitation sent successfully.", res);
                // Log call details.
                calllog(
                    isIncoming,
                    isVideo,
                    isMissed,
                    currentUserDisplayName,
                    currentUserId,
                    targetUserc,
                    room.roomId, // Added roomId argument
                );
            })
            .catch((err: any) => {
                console.error("Error sending group invitation:", err);
            });
    }

    // Log call details.
    async function calllog(
        isIncoming: boolean,
        isVideo: boolean,
        isMissed: boolean,
        currentUserDisplayName: string,
        currentUserId: string,
        userList: User[],
        roomId: string,
      ) {
        try {
          // ===============================
          // 1. Write the call log for the current user
          // ===============================
      
          // Reference to the current user's call log document in the "calllogs" collection.
          const userCallLogRef = doc(db, "calllogs", currentUserId);
      
          // Use setDoc with merge option to ensure we do not overwrite other data.
          await setDoc(userCallLogRef, { merge: true });
      
          // Get the current user's avatar from localStorage (or fallback to "null").
          const currentUserAvatar = localStorage.getItem("mx_user_avatar") || "null";
      
          // Filter out the current user from the userList to avoid duplicating their info.
          const filteredUserList = userList.filter(u => u.userID !== currentUserId);
      
          // Determine the order of names, images, and user IDs based on the call direction.
          let namesArray: string[];
          let imagesArray: string[];
          let userCalledIds: string[];
      
          if (isIncoming) {
            // For an incoming call: the caller(s) (from filteredUserList) come first,
            // followed by the current user (the receiver).
            namesArray = [
              ...filteredUserList.map((u) => u.userName),
              currentUserDisplayName,
            ];
            imagesArray = [
              ...filteredUserList.map((u) => u.img),
              currentUserAvatar,
            ];
            userCalledIds = [
              ...filteredUserList.map((u) => u.userID),
              currentUserId,
            ];
          } else {
            // For an outgoing call: the current user (the caller) comes first,
            // followed by the callee(s) (from filteredUserList).
            namesArray = [
              currentUserDisplayName,
              ...filteredUserList.map((u) => u.userName),
            ];
            imagesArray = [
              currentUserAvatar,
              ...filteredUserList.map((u) => u.img),
            ];
            userCalledIds = [
              currentUserId,
              ...filteredUserList.map((u) => u.userID),
            ];
          }
      
          // Prepare the call log data for the current user.
          const logData = {
            imageUrl: imagesArray,
            isIncoming: isIncoming,
            isMissedCall: isMissed,
            isVideoCall: isVideo,
            name: namesArray,
            roomId: roomId,
            userCalledId: userCalledIds,
          };
      
          // Reference to the "calls" subcollection under the current user's call log document.
          const callsCollectionRef = collection(db, "calllogs", currentUserId, "calls");
      
          // Add the call log entry for the current user.
          const docRef = await addDoc(callsCollectionRef, logData);
          console.log("Call log written with ID:", docRef.id);
      
          // Optionally, fetch and save the current user's call logs to localStorage.
          const querySnapshot = await getDocs(callsCollectionRef);
          const callLogs = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          localStorage.setItem("callLogs", JSON.stringify(callLogs));
          console.log("Saved call logs to localStorage:", callLogs);
      
          // ===============================
          // 2. Write the call log for each other user (marking the call as incoming for them)
          // ===============================
          for (const u of filteredUserList) {
            // For each other user, get a reference to their call log document.
            const otherUserCallLogRef = doc(db, "calllogs", u.userID);
            await setDoc(otherUserCallLogRef, { merge: true });
      
            // Get the "calls" subcollection reference for the other user.
            const otherCallsCollectionRef = collection(db, "calllogs", u.userID, "calls");
      
            // Build the call log entry for the other user.
            // Here, we force isIncoming to true so that from their perspective, the call appears as incoming.
            // We assume that the current user is the caller in this log entry.
            const otherLogData = {
              // The caller's avatar comes first, followed by the other user's avatar.
              imageUrl: [currentUserAvatar, u.img],
              isIncoming: true, // Force incoming for the other user.
              isMissedCall: isMissed,
              isVideoCall: isVideo,
              // For the other user, we show the current user's display name as the caller,
              // and their own name as the callee.
              name: [currentUserDisplayName, u.userName],
              roomId: roomId,
              // The call participants: the current user (caller) and the other user.
              userCalledId: [currentUserId, u.userID],
            };
      
            // Add the call log entry for the other user.
            const docRefOther = await addDoc(otherCallsCollectionRef, otherLogData);
            console.log("Call log written for user", u.userID, "with ID:", docRefOther.id);
          }
        } catch (error) {
          console.error("Error adding call log:", error);
        }
      }
      
    const onAvatarClick = (): void => {
        defaultDispatcher.dispatch({
            action: "open_room_settings",
            initial_tab_id: RoomSettingsTab.General,
        });
    };

    return (
        <>
            <CurrentRightPanelPhaseContextProvider roomId={room.roomId}>
                <Flex as="header" align="center" gap="var(--cpd-space-3x)" className="mx_RoomHeader light-panel">
                    <WithPresenceIndicator room={room} size="8px">
                        <RoomAvatar
                            room={room}
                            size="40px"
                            oobData={oobData}
                            onClick={onAvatarClick}
                            tabIndex={-1}
                            aria-label={_t("room|header_avatar_open_settings_label")}
                        />
                    </WithPresenceIndicator>
                    <button
                        aria-label={_t("right_panel|room_summary_card|title")}
                        tabIndex={0}
                        onClick={() => RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary)}
                        className="mx_RoomHeader_infoWrapper"
                    >
                        <Box flex="1" className="mx_RoomHeader_info">
                            <BodyText
                                as="div"
                                size="lg"
                                weight="semibold"
                                dir="auto"
                                role="heading"
                                aria-level={1}
                                className="mx_RoomHeader_heading"
                            >
                                <span className="mx_RoomHeader_truncated mx_lineClamp">{roomName}</span>

                                {!isDirectMessage && joinRule === JoinRule.Public && (
                                    <Tooltip label={_t("common|public_room")} placement="right">
                                        <PublicIcon
                                            width="16px"
                                            height="16px"
                                            className="mx_RoomHeader_icon text-secondary"
                                            aria-label={_t("common|public_room")}
                                        />
                                    </Tooltip>
                                )}

                                {isDirectMessage && e2eStatus === E2EStatus.Verified && (
                                    <Tooltip label={_t("common|verified")} placement="right">
                                        <VerifiedIcon
                                            width="16px"
                                            height="16px"
                                            className="mx_RoomHeader_icon mx_Verified"
                                            aria-label={_t("common|verified")}
                                        />
                                    </Tooltip>
                                )}

                                {isDirectMessage && e2eStatus === E2EStatus.Warning && (
                                    <Tooltip label={_t("room|header_untrusted_label")} placement="right">
                                        <ErrorIcon
                                            width="16px"
                                            height="16px"
                                            className="mx_RoomHeader_icon mx_Untrusted"
                                            aria-label={_t("room|header_untrusted_label")}
                                        />
                                    </Tooltip>
                                )}
                            </BodyText>
                        </Box>
                    </button>

                    <button style={{ background: "none", border: "none" }} onClick={GroupCallVoice} className="call">
                        <VoiceCallIcon style={{ fontSize: "20px" }} />
                    </button>

                    <button style={{ background: "none", border: "none" }} onClick={GroupCallVideo} className="call">
                        <VideoCallIcon style={{ fontSize: "20px" }} />
                    </button>

                    {notificationsEnabled && (
                        <Tooltip label={_t("notifications|enable_prompt_toast_title")}>
                            <IconButton
                                indicator={notificationLevelToIndicator(globalNotificationState.level)}
                                onClick={(evt) => {
                                    evt.stopPropagation();
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.NotificationPanel);
                                }}
                                aria-label={_t("notifications|enable_prompt_toast_title")}
                            >
                                <ToggleableIcon Icon={NotificationsIcon} phase={RightPanelPhases.NotificationPanel} />
                            </IconButton>
                        </Tooltip>
                    )}

                    <Tooltip label={_t("right_panel|room_summary_card|title")}>
                        <IconButton
                            onClick={(evt) => {
                                evt.stopPropagation();
                                RightPanelStore.instance.showOrHidePhase(RightPanelPhases.RoomSummary);
                            }}
                            aria-label={_t("right_panel|room_summary_card|title")}
                        >
                            <ToggleableIcon Icon={RoomInfoIcon} phase={RightPanelPhases.RoomSummary} />
                        </IconButton>
                    </Tooltip>

                    {!isDirectMessage && (
                        <BodyText as="div" size="sm" weight="medium">
                            <FacePile
                                className="mx_RoomHeader_members"
                                members={members.slice(0, 3)}
                                size="20px"
                                overflow={false}
                                viewUserOnClick={false}
                                tooltipLabel={_t("room|header_face_pile_tooltip")}
                                onClick={(e: ButtonEvent) => {
                                    RightPanelStore.instance.showOrHidePhase(RightPanelPhases.MemberList);
                                    e.stopPropagation();
                                }}
                                aria-label={_t("common|n_members", { count: memberCount })}
                            >
                                {formatCount(memberCount)}
                            </FacePile>
                        </BodyText>
                    )}
                </Flex>
                {askToJoinEnabled && <RoomKnocksBar room={room} />}
            </CurrentRightPanelPhaseContextProvider>
        </>
    );
}
