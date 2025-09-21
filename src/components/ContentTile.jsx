import React, { useState } from 'react';
import axios from 'axios';

const ContentTile = ({ content, isLoggedIn }) => {
    const [showCustomInput, setShowCustomInput] = useState(false);

    const handleReminder = async () => {
        try {
            await axios.post('/api/reminders', {
                contentId: content.id,
                release_date: content.releaseDate,
                content_title: content.title,
                content_type: content.type || 'default'
            });
            alert('Reminder set successfully.');
        } catch (error) {
            console.error(error);
            alert('Failed to set reminder. Please try again.');
        }
    };

    const handleCustomReminder = async () => {
        const customDateTime = prompt('Enter reminder date and time (YYYY-MM-DD HH:MM):');
        if (!customDateTime) return;
        try {
            await axios.post('/api/reminders', {
                contentId: content.id,
                release_date: customDateTime,
                content_title: content.title,
                content_type: content.type || 'default'
            });
            alert('Reminder set successfully.');
        } catch (error) {
            console.error(error);
            alert('Failed to set reminder. Please try again.');
        }
    };

    // Check if content release is in the future
    const isUpcoming = new Date(content.releaseDate) > new Date();

    return (
        <div className="content-tile">
            <h3>{content.title}</h3>
            {!isLoggedIn && (
                <button onClick={() => window.location.href = '/login'}>
                    Login to set reminder
                </button>
            )}
            {isLoggedIn && (
                isUpcoming ? (
                    <button onClick={handleReminder}>Remind Me</button>
                ) : (
                    <button onClick={handleCustomReminder}>Remind Me</button>
                )
            )}
        </div>
    );
};

export default ContentTile;