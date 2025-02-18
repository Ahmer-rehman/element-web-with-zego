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

    interface ZegoSignalingPluginNotificationConfig {
        resourcesID?: string;
        title?: string;
        message?: string;
      }
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
    const myRoomConfig: RoomConfig = {
      turnOnMicrophoneWhenJoining: true,
      showMyCameraToggleButton: true,
      showMyMicrophoneToggleButton: true,
      showAudioVideoSettingsButton: true,
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
      const currentUserDisplayName =
        localStorage.getItem("mx_profile_displayname") || "";
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
          currentUserDisplayName
        );
    
        if (!KitToken) {
          console.error("Failed to generate Kit Token.");
          return;
        }
    
        const zegoInstance = ZegoUIKitPrebuilt.create(KitToken);
        zegoInstance.addPlugins({ ZIM });
    
        // Make sure that myRoomConfig is defined elsewhere in your code.
        zegoInstance.setCallInvitationConfig({
          // Toggle UI elements for call invitation.
          enableNotifyWhenAppRunningInBackgroundOrQuit: true,
          onSetRoomConfigBeforeJoining: (callType) => ({
            // Spread your RoomConfig settings first.
            ...myRoomConfig,
            // Then add/override with Zego-specific settings.
            showTextChat: false,
            showScreenSharingButton: false,
            turnOnCameraWhenJoining: false,
          }),
          onSetRoomConfigAfterJoining: (callType) => ({
            // Spread your RoomConfig settings first.
            ...myRoomConfig,
            // Then add/override with Zego-specific settings.
            showTextChat: false,
            showScreenSharingButton: false,
          }),
          // Configure ringtone URLs for incoming and outgoing calls.
          ringtoneConfig: {
            incomingCallUrl:
              "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ring.ogg?alt=media&token=f7ff8103-a1e5-42a6-a7d3-12c73b5bda2e",
            outgoingCallUrl:
              "https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ringback.ogg?alt=media&token=308068d4-a9af-4b1f-a4da-d8cc1f237685",
          },
        });
    
        // Store the initialized instance and log success.
        setZp(zegoInstance);
        console.log("Zego UI Kit initialized successfully with ZIM plugin.");
        localStorage.setItem("initialized", "true");
      } catch (error) {
        console.error("Error initializing Zego UI Kit:", error);
      }
    }
    
    
  

    // Filter and update members, excluding the current user.
    useEffect(() => {
        // Retrieve and clean the current user's ID from localStorage
        const tempId = localStorage.getItem('mx_user_id');
        const currentUserId = tempId ? cleanUserId(tempId) : '';
        
      
        // Filter out the current user from the members list
        const filteredMembers = members
          .filter((member) => {
            // Determine the member's ID from either member.user.id or member.userId
            const memberId = member.user?.id || member.userId || '';
            const cleanedMemberId = cleanUserId(memberId);
            // Keep this member only if its cleaned ID is NOT the current user's ID
            return cleanedMemberId !== currentUserId;
          })
          .map((member) => {
            // Ensure each member object has an `imgurl` property for convenience
            const img = member.user?.avatarUrl || member.imgurl || null;
            return { ...member, imgurl: img };
          });
      
        setOtherMembers(filteredMembers);
      }, [members]);
      
      

    // Group call function for voice calls.
    function GroupCallVoice() {
      try {
        const currentUserId = localStorage.getItem('mx_user_id') || '';
        const currentUserDisplayName = localStorage.getItem('mx_profile_displayname') || '';
    
        if (!zp) {
          console.error('Zego UI Kit is not initialized yet.');
          return;
        }
    
        // Prepare the target users for the invitation.
        const targetUsers = otherMembers.map((member) => {
          const cleanedUserId = cleanUserId(member.userId);
          console.log(
            `Preparing invitation for User: ${member.rawDisplayName} (ID: ${cleanedUserId})`
          );
          return {
            userID: cleanedUserId,
            userName: member.rawDisplayName,
          };
        });
        console.log('Target user array:', targetUsers);
    
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
          mediaconfig: {
            audio: true,
            video: false,
          },
        })
          .then((res) => {
            console.warn('Group invitation sent successfully.', res);
            // Log call details.
            calllog(
              isIncoming,
              isVideo,
              isMissed,
              currentUserDisplayName,
              currentUserId,
              targetUserc,
              room.roomId
            );
          })
          .catch((err) => {
            // Log the error; no alert or user-facing notification will be shown.
            console.error('Error sending group invitation:', err);
          });
      } catch (error) {
        console.error('Unexpected error in GroupCallVoice:', error);
      }
    }
    
    function GroupCallVideo() {
      try {
        const currentUserId = localStorage.getItem('mx_user_id') || '';
        const currentUserDisplayName = localStorage.getItem('mx_profile_displayname') || '';
    
        if (!zp) {
          console.error('Zego UI Kit is not initialized yet.');
          return;
        }
    
        // Prepare the target users for the invitation.
        const targetUsers = otherMembers.map((member) => {
          const cleanedUserId = cleanUserId(member.userId);
          console.log(
            `Preparing invitation for User: ${member.rawDisplayName} (ID: ${cleanedUserId})`
          );
          return {
            userID: cleanedUserId,
            userName: member.rawDisplayName,
          };
        });
        console.log('Target user array:', targetUsers);
    
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
          mediaconfig: {
            audio: true,
            video: true,
          },
        })
          .then((res) => {
            console.warn('Group invitation sent successfully.', res);
            // Log call details.
            calllog(
              isIncoming,
              isVideo,
              isMissed,
              currentUserDisplayName,
              currentUserId,
              targetUserc,
              room.roomId
            );
          })
          .catch((err) => {
            // Log the error; no alert or user-facing notification will be shown.
            console.error('Error sending group invitation:', err);
          });
      } catch (error) {
        console.error('Unexpected error in GroupCallVideo:', error);
      }
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
      room?: { name?: string } // optionally pass in a room object with a name property
    ) {
      try {
        // Ensure current user's call log document exists.
        const userCallLogRef = doc(db, "calllogs", currentUserId);
        await setDoc(userCallLogRef, {}, { merge: true });
    
        const currentUserAvatar = localStorage.getItem("mx_user_avatar") || "null";
        // Remove the current user from the list.
        const filteredUserList = userList.filter((u) => u.userID !== currentUserId);
    
        // Check if this is a one-to-one call (one other user) or a group call (more than one)
        const isOneToOne = filteredUserList.length === 1;
    
        if (isOneToOne) {
          // ===== ONE-TO-ONE CALL LOGS =====
          const otherUser = filteredUserList[0];
    
          // Build the call type label for one-to-one calls.
          const currentCallTypeLabel = isVideo
            ? isIncoming
              ? "Incoming Video Call"
              : "Outgoing Video Call"
            : isIncoming
            ? "Incoming Audio Call"
            : "Outgoing Audio Call";
    
          // For one-to-one calls, include the other user's name before the label.
          let finalNameForCurrent = `${otherUser.userName} - ${currentCallTypeLabel}`;
          if (room && room.name && room.name.trim() !== "") {
            finalNameForCurrent = room.name;
          }
    
          // Current user's log (shows the other user's icon).
          const currentLogData = {
            imageUrl: otherUser.img, // other user's icon
            isIncoming: isIncoming,
            isMissedCall: isMissed,
            isVideoCall: isVideo,
            name: finalNameForCurrent,
            roomId: roomId,
            userCalledId: [otherUser.userID],
          };
    
          const callsCollectionRef = collection(db, "calllogs", currentUserId, "calls");
          const docRef = await addDoc(callsCollectionRef, currentLogData);
          console.log("Call log written with ID:", docRef.id);
    
          // Optionally, update localStorage with the latest logs.
          const querySnapshot = await getDocs(callsCollectionRef);
          const callLogs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          localStorage.setItem("callLogs", JSON.stringify(callLogs));
          console.log("Saved call logs to localStorage:", callLogs);
    
          // ----- Now write the log for the other user -----
          // For the other user, show the current user's details.
          const otherUserCallLogRef = doc(db, "calllogs", otherUser.userID);
          await setDoc(otherUserCallLogRef, {}, { merge: true });
          const otherCallsCollectionRef = collection(db, "calllogs", otherUser.userID, "calls");
    
          // From the other user's perspective, the call is incoming.
          const otherCallTypeLabel = isVideo ? "Incoming Video Call" : "Incoming Audio Call";
          let finalNameForOther = `${currentUserDisplayName} - ${otherCallTypeLabel}`;
          if (room && room.name && room.name.trim() !== "") {
            finalNameForOther = room.name;
          }
          const otherLogData = {
            imageUrl: currentUserAvatar, // current user's icon
            isIncoming: true, // always incoming for the receiving user
            isMissedCall: isMissed,
            isVideoCall: isVideo,
            name: finalNameForOther,
            roomId: roomId,
            userCalledId: [currentUserId],
          };
    
          const docRefOther = await addDoc(otherCallsCollectionRef, otherLogData);
          console.log("Call log written for user", otherUser.userID, "with ID:", docRefOther.id);
        } else {
          // ===== GROUP CALL LOGS =====
    
          let namesArray: string[];
          let imagesArray: string[];
          let userCalledIds: string[];
    
          if (isIncoming) {
            // For incoming calls, list the callers first, then the receiver.
            namesArray = [...filteredUserList.map((u) => u.userName), currentUserDisplayName];
            imagesArray = [...filteredUserList.map((u) => u.img), currentUserAvatar];
            userCalledIds = [...filteredUserList.map((u) => u.userID), currentUserId];
          } else {
            // For outgoing calls, current user first, then callees.
            namesArray = [currentUserDisplayName, ...filteredUserList.map((u) => u.userName)];
            imagesArray = [currentUserAvatar, ...filteredUserList.map((u) => u.img)];
            userCalledIds = [currentUserId, ...filteredUserList.map((u) => u.userID)];
          }
    
          // Build a dynamic base label.
          let baseLabel = isVideo
            ? isIncoming
              ? "Incoming Video"
              : "Outgoing Video"
            : isIncoming
            ? "Incoming Audio"
            : "Outgoing Audio";
          // Since this is a group call (more than one other user), append "Group Call".
          baseLabel += " Group Call";
    
          // Use the room name if provided; otherwise use the dynamically built label.
          const finalNameForCurrent =
            room && room.name && room.name.trim() !== "" ? room.name : baseLabel;
    
          const groupLogData = {
            imageUrl: imagesArray,
            isIncoming: isIncoming,
            isMissedCall: isMissed,
            isVideoCall: isVideo,
            name: finalNameForCurrent,
            roomId: roomId,
            userCalledId: userCalledIds,
          };
    
          const callsCollectionRef = collection(db, "calllogs", currentUserId, "calls");
          const docRef = await addDoc(callsCollectionRef, groupLogData);
          console.log("Group call log written with ID:", docRef.id);
    
          const querySnapshot = await getDocs(callsCollectionRef);
          const callLogs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          localStorage.setItem("callLogs", JSON.stringify(callLogs));
          console.log("Saved group call logs to localStorage:", callLogs);
    
          // Write the call log for each other user in the group.
          for (const u of filteredUserList) {
            const otherUserCallLogRef = doc(db, "calllogs", u.userID);
            await setDoc(otherUserCallLogRef, {}, { merge: true });
            const otherCallsCollectionRef = collection(db, "calllogs", u.userID, "calls");
    
            // From the perspective of each other user, the call is incoming.
            let otherBaseLabel = isVideo ? "Incoming Video" : "Incoming Audio";
            otherBaseLabel += " Group Call";
            const finalNameForOther =
              room && room.name && room.name.trim() !== "" ? room.name : otherBaseLabel;
    
            const otherLogData = {
              imageUrl: [currentUserAvatar, u.img],
              isIncoming: true,
              isMissedCall: isMissed,
              isVideoCall: isVideo,
              name: finalNameForOther,
              roomId: roomId,
              userCalledId: [currentUserId, u.userID],
            };
    
            const docRefOther = await addDoc(otherCallsCollectionRef, otherLogData);
            console.log("Group call log written for user", u.userID, "with ID:", docRefOther.id);
          }
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
