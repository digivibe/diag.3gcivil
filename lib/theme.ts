export const THEME_STORAGE_KEY = "3gcivil-theme";

/** Exécuté avant le premier rendu (dans <head>) pour appliquer le thème mémorisé sans flash. */
export const themeBootstrapScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
