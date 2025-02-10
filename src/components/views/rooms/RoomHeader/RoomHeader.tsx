/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

PDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React, { useState, useEffect } from "react";
import app from "./Firebase";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
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
    let callStartTime = null;
    let callEndTime = null;
    /**
     * A special mode where only Element Call is used. In this case we want to
     * hide the voice call button
     */
    const globalNotificationState = useGlobalNotificationState();
    type Member = {
        membership?: string;
        roomId: string;
        userId: string;
        rawDisplayName: string;
    };

    const dmMember = useDmMember(room);
    const isDirectMessage = !!dmMember;
    const e2eStatus = useEncryptionStatus(client, room);
    const appid = 1146553792;
    const serversecret = '804182900b0b2337d9bfa362b3630ace';

    const notificationsEnabled = useFeatureEnabled("feature_notifications");
    const askToJoinEnabled = useFeatureEnabled("feature_ask_to_join");
    const [otherMembers, setOtherMembers] = useState<Member[]>([]);
    const [zp, setZp] = useState(null);

    const cleanUserId = (id) => {
        console.log("Original ID before cleaning:", id);
      
        // Remove any character that is not a letter or a digit
        const cleanedId = id.replace(/[^a-zA-Z0-9]/g, '');
        console.log("Cleaned ID:", cleanedId);
      
        return cleanedId;
    };

    useEffect(() => {
        init();  // Initialize Zego UI Kit when the component mounts
    }, []);

    function init() {
        // Retrieve the current user details from localStorage
        let temp = localStorage.getItem("mx_user_id") || "";
        let currentUserDisplayName = localStorage.getItem("mx_profile_displayname") || "";
        // Ensure `temp` is not null before processing
        const currentUserId = temp ? cleanUserId(temp) : "";
        console.log('my ids',currentUserId,currentUserDisplayName);
        // Validate if the retrieved values exist
        if (!currentUserId || !currentUserDisplayName) {
            console.error("Error: Missing User ID or Display Name in localStorage.");
            return;
        }
    
        try {
            // Generate the Kit Token for authentication
            const KitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
                appid,
                serversecret,
                room.roomId,
                currentUserId,  // Use the cleaned userId
                currentUserDisplayName
            );
    
            if (!KitToken) {
                console.error("Failed to generate Kit Token.");
                return;
            }
    
            // Create Zego UI Kit instance with the generated token
            const zegoInstance = ZegoUIKitPrebuilt.create(KitToken);
    
            // Add ZIM Plugin to the Zego UI Kit instance
            zegoInstance.addPlugins({ ZIM });
            zegoInstance.setCallInvitationConfig({
                ringtoneConfig: {
                    // URL for the ringtone played when receiving an incoming call invitation.
                    incomingCallUrl: 'https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ring.ogg?alt=media&token=f7ff8103-a1e5-42a6-a7d3-12c73b5bda2e',
                    // URL for the ringtone played when sending a call invitation.
                    outgoingCallUrl: 'https://firebasestorage.googleapis.com/v0/b/laaleh-2451e.appspot.com/o/ringback.ogg?alt=media&token=308068d4-a9af-4b1f-a4da-d8cc1f237685'
                }
            });
            
             
            // Set zp to the created instance
            setZp(zegoInstance);
    
            console.log("Zego UI Kit initialized successfully with ZIM plugin.");
    
            // Set a flag in localStorage to prevent further initialization
            localStorage.setItem("initialized", "true");
    
        } catch (error) {
            console.error("Error initializing Zego UI Kit:", error);
        }
    }
    
    useEffect(() => {
        // Retrieve user data from localStorage
        let tempId = localStorage.getItem("mx_user_id");
        let currentUserDisplayName = localStorage.getItem("mx_profile_displayname");
    
        // Ensure values are retrieved correctly
        console.log("Temp ID from localStorage:", tempId);
        console.log("Current User Display Name from localStorage:", currentUserDisplayName);
    
        // Clean the userId to remove unwanted characters and domain part
        const currentUserId = tempId ? cleanUserId(tempId) : '';
        const currentUserDisplayNameCleaned = currentUserDisplayName ? currentUserDisplayName.trim() : '';
    
        console.log("Cleaned User ID:", currentUserId); // Debugging the cleaned userId
        console.log("Cleaned Display Name:", currentUserDisplayNameCleaned); // Debugging the cleaned display name
    
        const filteredMembers = members.filter(member => {
            // Clean member userId and trim displayName
            let cleanedUserId = member.userId ? cleanUserId(member.userId) : '';
            let cleanedDisplayName = member.rawDisplayName ? member.rawDisplayName.trim() : '';
    
            console.log("Member User ID (cleaned):", cleanedUserId);
            console.log("Member Display Name (cleaned):", cleanedDisplayName);
    
            // If the member is the current user, don't include them in the list
            return !(cleanedUserId === currentUserId && cleanedDisplayName === currentUserDisplayNameCleaned);
        });
    
        console.log("Filtered Members (excluding current user):", filteredMembers);
    
        // Update the state with filtered members
        setOtherMembers(filteredMembers);
    }, [members]);
    
   function GroupCallVoice() {
    if (!zp) {
        console.error("Zego UI Kit is not initialized yet.");
        return;
    }

    // Map all otherMembers to the target user format
    const targetUsers = otherMembers.map(member => {
        const cleanedUserId = cleanUserId(member.userId);
        console.log(`Preparing invitation for User: ${member.rawDisplayName} (ID: ${cleanedUserId})`);
        return {
            userID: cleanedUserId, // Use the cleaned user ID
            userName: member.rawDisplayName
        };
    });

    // Send one group invitation to all target users
    zp.sendCallInvitation({
        callees: targetUsers, // Pass the entire array of target users
        callType: ZegoUIKitPrebuilt.InvitationTypeVoiceCall,
        timeout: 60,
    })
    .then((res) => {
        console.warn("Group invitation sent successfully.", res);
    })
    .catch((err) => {
        console.error("Error sending group invitation:", err);
    });
}
   function GroupCallVideo() {
    if (!zp) {
        console.error("Zego UI Kit is not initialized yet.");
        return;
    }

    // Map all otherMembers to the target user format
    const targetUsers = otherMembers.map(member => {
        const cleanedUserId = cleanUserId(member.userId);
        console.log(`Preparing invitation for User: ${member.rawDisplayName} (ID: ${cleanedUserId})`);
        return {
            userID: cleanedUserId, // Use the cleaned user ID
            userName: member.rawDisplayName
        };
    });
    
    // Send one group invitation to all target users
    zp.sendCallInvitation({
        callees: targetUsers, // Pass the entire array of target users
        callType: ZegoUIKitPrebuilt.InvitationTypeVideoCall,
        timeout: 60,
    })
    .then((res) => {
        console.warn("Group invitation sent successfully.", res);
    })
    .catch((err) => {
        console.error("Error sending group invitation:", err);
    });
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
                        {/* We hide this from the tabIndex list as it is a pointer shortcut and superfluous for a11y */}
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
                    <button style={{background:"none",border:"none"}} onClick={GroupCallVideo} className="call">
                        <VideoCallIcon style={{ fontSize: "20px" }} />
                    </button>

                    <button style={{background:"none",border:"none"}} onClick={GroupCallVoice} className="call">
                        <VoiceCallIcon  style={{ fontSize: "20px" }} />
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
