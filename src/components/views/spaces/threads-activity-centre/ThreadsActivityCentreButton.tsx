/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */
import React, { useState, useEffect } from 'react';
import { BsClockHistory } from 'react-icons/bs';
import { FaPhone } from 'react-icons/fa';
import { LuPhoneIncoming, LuPhoneOutgoing } from 'react-icons/lu'; // New icons

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDz9uiR4jtthJQ3oXRBtDGF3RTGF9sUOjE",
  authDomain: "beep-7a8b4.firebaseapp.com",
  projectId: "beep-7a8b4",
  storageBucket: "beep-7a8b4.firebasestorage.app",
  messagingSenderId: "264530976033",
  appId: "1:264530976033:web:a50c0faa52dbd7c3abb260"
};

// Initialize Firebase and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const ThreadsActivityCentreButton = () => {
  // State to manage the overlay visibility and fetched call logs
  const [isOverlayVisible, setOverlayVisible] = useState(false);
  const [callLogs, setCallLogs] = useState([]);

  // Handler to show the overlay
  const handleCallLogClick = () => {
    setOverlayVisible(true);
  };

  // Handler to hide the overlay
  const handleOverlayClose = () => {
    setOverlayVisible(false);
  };

  // Function to fetch call logs from Firebase Firestore
  const fetchCallLogs = async () => {
    try {
      // Retrieve the current user ID using the key "mx_user_id"
      const currentUserId = localStorage.getItem("mx_user_id") || "";
      
      // The Firestore path will be:
      // calllogs -> @ahmer-eng:ms.beep.gov.pk -> calls
      const callsCollectionRef = collection(db, "calllogs", currentUserId, "calls");
      
      // Fetch all documents in the subcollection
      const querySnapshot = await getDocs(callsCollectionRef);
      const logs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Update state with the fetched call logs
      setCallLogs(logs);
    } catch (error) {
      console.error("Error fetching call logs:", error);
    }
  };

  // Log call logs to the console for debugging
  console.log(callLogs);

  // Use useEffect to fetch call logs when the overlay is opened
  useEffect(() => {
    if (isOverlayVisible) {
      fetchCallLogs();
    }
  }, [isOverlayVisible]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
        <button
          style={{ border: 'none', background: 'none', display: 'flex' }}
          onClick={handleCallLogClick}
        >
          <BsClockHistory
            size={24}
            style={{
              height: '21px',
              width: '14px',
              position: 'relative',
              right: '-11px',
              top: '-6px',
              color: '#818a95',
            }}
          />
          <FaPhone size={24} style={{ color: '#818a95', marginRight: '8px' }} />
        </button>
      </div>

      {/* Overlay with right side panel */}
      {isOverlayVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
          }}
        >
          {/* Backdrop to cover entire screen */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.3)',
            }}
            onClick={handleOverlayClose}
          />

          {/* Right side panel */}
          <div
            style={{
              position: 'absolute',
              top: "2px",
              right: "7px",
              bottom: 0,
              width: '300px',
              background: '#fff',
              padding: '20px',
              boxShadow: '-2px 0 5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              overflowY: 'auto',
              border: "6px solid lightgrey",
              borderRadius:"10px",
              height: "94vh",
            }}
          >
            {callLogs && callLogs.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, width: '100%' }}>
                {callLogs.map((log) => {
                  // Determine the call type text based on isIncoming and isVideoCall
                  const callTypeText = log.isIncoming 
                    ? (log.isVideoCall ? "Incoming Video Call" : "Incoming Audio Call")
                    : (log.isVideoCall ? "Outgoing Video Call" : "Outgoing Audio Call");

                  return (
                    <li
                      key={log.id}
                      style={{
                        borderBottom: "1px solid #ccc",
                        marginBottom: "10px",
                        paddingBottom: "10px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "bold" }}>
                          {log.name && Array.isArray(log.name)
                            ? log.name.join(", ")
                            : "Unknown"}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {log.isIncoming ? (
                            <LuPhoneIncoming style={{ color: 'red', marginRight: '5px' }} />
                          ) : (
                            <LuPhoneOutgoing style={{ color: 'green', marginRight: '5px' }} />
                          )}
                          <span>
                            {callTypeText}
                            {log.isMissedCall ? " - Missed" : ""}
                          </span>
                        </div>
                        {log.date && <div>Date: {log.date}</div>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No call logs found.</p>
            )}

            <button
              onClick={handleOverlayClose}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '4px',
                background: '#818a95',
                color: '#fff',
                cursor: 'pointer',
                marginTop: '20px'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
