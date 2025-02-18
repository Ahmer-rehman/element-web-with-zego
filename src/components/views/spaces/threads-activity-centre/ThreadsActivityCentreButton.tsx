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
import { LuPhoneIncoming, LuPhoneOutgoing } from 'react-icons/lu';

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

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
  // State to manage overlay visibility and fetched call logs
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

  // Realtime listener: fetch and sort call logs (latest by time first)
  useEffect(() => {
    let unsubscribe;
    if (isOverlayVisible) {
      const currentUserId = localStorage.getItem("mx_user_id") || "";
      const callsCollectionRef = collection(db, "calllogs", currentUserId, "calls");

      unsubscribe = onSnapshot(callsCollectionRef, (snapshot) => {
        const logs = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateB - dateA;
          });

        setCallLogs(logs);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOverlayVisible]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
        <button
          style={{ border: 'none', background: 'none', display: 'flex', cursor: 'pointer' }}
          onClick={handleCallLogClick}
          aria-label="Show call logs"
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

      {/* Overlay */}
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
          {/* Backdrop */}
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
              top: '2px',
              right: '7px',
              bottom: 0,
              width: '300px',
              background: '#fff',
              padding: '20px',
              boxShadow: '-2px 0 5px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              border: '6px solid lightgrey',
              borderRadius: '10px',
              height: '94vh',
              zIndex: 10001,
            }}
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside the panel from closing the overlay
          >
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                onClick={handleOverlayClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
                aria-label="Close call logs"
              >
                X
              </button>
            </div>

            <div style={{ width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              {callLogs && callLogs.length > 0 ? (
                // Reverse the sorted logs array before mapping to display in reverse order.
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {callLogs.slice().reverse().map((log) => (
                    <li
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #ccc',
                        marginBottom: '10px',
                        paddingBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {log.isIncoming ? (
                        <LuPhoneIncoming style={{ color: 'red', marginRight: '10px' }} />
                      ) : (
                        <LuPhoneOutgoing style={{ color: 'green', marginRight: '10px' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        {/* Split the log.name into two lines if it contains ' - ' */}
                        <div style={{ fontWeight: 'bold' }}>
                          {log.name &&
                          typeof log.name === 'string' &&
                          log.name.includes(' - ') ? (
                            <>
                              <div>{log.name.split(' - ')[0].trim()}</div>
                              <div style={{ fontSize: '0.85em', color: '#555' }}>
                                {log.name.split(' - ')[1].trim()}
                              </div>
                            </>
                          ) : (
                            log.name || 'Unknown'
                          )}
                        </div>
                        {log.date && (
                          <div>
                            Date: {new Date(log.date).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No call logs found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
