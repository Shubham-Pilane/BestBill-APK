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

    React.useEffect(() => {
        const handleInvalid = (e) => {
            if (!e.target || typeof e.target.setCustomValidity !== 'function') return;
            if (language === 'mr') {
                const message = t('please_fill_field', 'कृपया हे क्षेत्र भरा.');
                e.target.setCustomValidity(message);
            } else {
                e.target.setCustomValidity('');
            }
        };

        const handleInput = (e) => {
            if (e.target && typeof e.target.setCustomValidity === 'function') {
                e.target.setCustomValidity('');
            }
        };

        document.addEventListener('invalid', handleInvalid, true);
        document.addEventListener('input', handleInput, true);
        document.addEventListener('change', handleInput, true);

        return () => {
            document.removeEventListener('invalid', handleInvalid, true);
            document.removeEventListener('input', handleInput, true);
            document.removeEventListener('change', handleInput, true);
        };
    }, [language]);

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
