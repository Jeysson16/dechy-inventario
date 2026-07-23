import containerQueries from '@tailwindcss/container-queries';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "rgb(var(--color-primary-rgb) / <alpha-value>)",
                "primary-light": "rgb(var(--color-primary-light-rgb) / <alpha-value>)",
                "background-light": "#f3f3f3",
                "background-dark": "#272d3f",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
            },
        },
    },
    plugins: [
        forms,
        containerQueries
    ],
}
