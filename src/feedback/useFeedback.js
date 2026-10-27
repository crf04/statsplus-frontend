import { createContext, useContext } from 'react';

export const FeedbackContext = createContext(null);

/** The Feedback controls, or null while nobody is signed in or outside a provider. */
export const useFeedback = () => useContext(FeedbackContext);
