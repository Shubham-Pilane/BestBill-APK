import React, { createContext, useContext, useState } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguageState] = useState(() => {
        return localStorage.getItem('app_language') || 'en';
    });

    const setLanguage = (lang) => {
        setLanguageState(lang);
        localStorage.setItem('app_language', lang);
    };

    const t = (key, fallbackText) => {
        const langDict = translations[language] || translations.en;
        if (langDict && langDict[key]) {
            return langDict[key];
        }
        if (translations.en[key]) {
            return translations.en[key];
        }
        return fallbackText !== undefined ? fallbackText : key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
