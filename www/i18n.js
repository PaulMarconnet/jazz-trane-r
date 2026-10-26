// =========================================================================
// MOTEUR D'INTERNATIONALISATION (FR / EN) — JAZZ TRANE'R
// Terminologie authentique Jazz & Music Education (Berklee / Jazz Lesson Videos / iReal Pro)
// =========================================================================

const CATEGORIES_DEFAUT_FR = {
    "Voicings": ["II V I majeur", "II V I mineur", "Mineur", "Majeur", "Dominante", "Diminué", "Drop 2", "So What", "Autres"],
    "Patterns": ["Majeur", "Mineur", "Dominante", "Pentatonique", "Diminué", "Autres"],
    "Licks": ["II V I majeur", "II V I mineur", "I VI II V", "Blues", "Autres"],
    "Morceaux": [],
    "Projets": [],
    "Relevés": [],
    "Technique": ["Gammes majeures", "Gammes mineures", "Gammes dominantes", "Hanon", "Autres"]
};

const CATEGORIES_DEFAUT_EN = {
    "Voicings": ["Major II-V-I", "Minor II-V-I", "Minor", "Major", "Dominant", "Diminished", "Drop 2", "So What", "Other"],
    "Patterns": ["Major", "Minor", "Dominant", "Pentatonic", "Diminished", "Other"],
    "Licks": ["Major II-V-I", "Minor II-V-I", "I-VI-II-V", "Blues", "Other"],
    "Tunes": [],
    "Projects": [],
    "Transcriptions": [],
    "Technique": ["Major Scales", "Minor Scales", "Dominant Scales", "Hanon", "Other"]
};

const I18N_DICT = {
    fr: {
        // Navigation
        "nav.logo_aria": "Logo Jazz Trane'R",
        "nav.back_to_session": "Retour à la séance",
        "nav.settings": "Paramètres",
        "nav.metronome": "Métronome",
        "nav.practice": "Pratique",
        "nav.history": "Historique",
        "nav.library": "Bibliothèque",
        "nav.new_session_title": "Programme de la séance",
        "nav.session": "Séance",

        // Vue Pratique
        "practice.break_title": "Petite pause ?",
        "practice.cancel_break_title": "Annuler la pause",
        "practice.pause_resume_title": "Pause/Reprendre",
        "practice.loading": "Chargement...",
        "practice.end_session": "Terminer la séance",
        "practice.save": "Sauvegarder",
        "practice.discard_stats_title": "Ne pas sauvegarder les stats",
        "practice.session_of_date": "Séance du {date}",
        "practice.key_of_day": "Tonalité principale : {key}",
        "practice.resource": "Ressource",
        "practice.reorder": "Réorganiser",
        "practice.exercise_default": "Exercice",
        "practice.timer_done_title": "Chronomètre terminé !",
        "practice.time_up_item": "Temps écoulé : {name}",
        "practice.time_up_body": "Temps écoulé, exercice terminé !",
        "practice.time_up_short": "Temps écoulé !",
        "practice.break_done_title": "Pause café terminée !",
        "practice.break_done_body": "Prêt à reprendre la séance de piano ?",
        "practice.session_completed_saved": "Séance terminée et sauvegardée",
        "practice.session_ended": "Séance terminée",
        "practice.afk_auto_closed": "Séance clôturée automatiquement : inactivité détectée pendant plus d'une heure en dépassement. Vos exercices ont été enregistrés dans l'historique.",
        "practice.done": "Terminé",
        "practice.finish": "Terminer",
        "practice.pause": "Pause",
        "practice.resume": "Reprendre",
        "practice.paused_overtime": "En pause (+ {time})",
        "practice.paused_time": "En pause ({time})",
        "practice.mark_practiced": "Marquer comme bossé",
        "practice.already_practiced_undo": "Déjà pratiqué ! (Cliquer pour annuler)",
        "practice.free_practice": "Exercice libre",
        "practice.no_matching_items": "Aucun morceau ne correspond.",
        "practice.exit_focus_mode": "Quitter le mode immersif",

        // Vue Création de séance
        "creation.title": "Préparer la séance",
        "creation.key_section": "Tonalité principale",
        "creation.random_key": "Aléatoire",
        "creation.add_exercise_section": "Ajouter un exercice",
        "creation.details_btn": "+ Détails...",
        "creation.details_placeholder": "Contenu détaillé de l'exercice...",
        "creation.sub_5_min": "Retirer 5 minutes",
        "creation.swipe_time_title": "Glisser vers le haut/bas ou molette pour ajuster la durée",
        "creation.minutes_label": "MINUTES",
        "creation.add_5_min": "Ajouter 5 minutes",
        "creation.add_to_session": "Ajouter à la séance",
        "creation.update_exercise": "Modifier l'exercice",
        "creation.session_section": "Programme de la séance",
        "creation.import_routine_title": "Importer une routine",
        "creation.save_routine_title": "Enregistrer ce brouillon comme routine",
        "creation.save_session_btn": "Démarrer la séance",
        "creation.alert_choose_category": "Veuillez d'abord choisir une catégorie.",

        // Vue Bibliothèque
        "library.title": "Bibliothèque musicale",
        "library.reset": "Réinitialiser",
        "library.add_section": "Ajouter à la bibliothèque",
        "library.import_sort_title": "Importer des fichiers (ZIP ou sélection multiple PDF/images/audio) dans le Trieur Express",
        "library.import_sort_btn": "Importer et Trier",
        "library.dictaphone_title": "Dictaphone (Enregistreur)",
        "library.dictaphone_rec_title": "Enregistrement en cours (Dictaphone)",
        "library.notebook_title": "Cahier de musique manuscrit",
        "library.item_name_label": "Nom de l'élément",
        "library.item_name_placeholder": "Nom...",
        "library.category_label": "Catégorie",
        "library.subcategory_label": "Sous-catégorie",
        "library.score_label": "Partition associée",
        "library.choose_files": "Choisir des fichiers",
        "library.choose_file": "Choisir un fichier",
        "library.no_file_chosen": "Aucun fichier choisi",
        "library.files_selected": "{count} fichiers sélectionnés",
        "library.audio_label": "Audio associé",
        "library.add_btn": "Ajouter",
        "library.setlists_btn": "Setlists",
        "library.search_placeholder": "Rechercher...",
        "library.fav_filter_title": "Afficher uniquement les favoris",
        "library.filter_btn": "Filtre",
        "library.all_categories": "Toutes les catégories",
        "library.sort_btn": "Tri",
        "library.sort_az": "De A à Z",
        "library.sort_za": "De Z à A",
        "library.sort_most": "Les plus travaillés",
        "library.sort_least": "Les moins travaillés",
        "library.loading": "Chargement du vocabulaire...",
        "library.no_items": "Aucun élément trouvé.",
        "library.untitled": "Sans titre",
        "library.practiced_count": "Pratiqué {count} fois",
        "library.play_backing_title": "Écouter le morceau / backing track",
        "library.open_pdf_title": "Ouvrir le PDF",
        "library.open_pdf_score_title": "Ouvrir la partition PDF",
        "library.click_enlarge_title": "Clique pour agrandir",
        "library.score_badge": "Partition",
        "library.current_cat_suffix": "{type} (actuelle)",
        "library.file_default": "Fichier",
        "library.score_pages_info": "Partition ({count} p.) : {name}",
        "library.score_attached_info": "Partition associée : {name}",
        "library.remove_score_title": "Supprimer la partition",
        "library.audio_attached_info": "Audio associé : {name}",
        "library.remove_audio_title": "Supprimer l'audio",
        "library.removed_on_save_f": "Supprimée à l'enregistrement",
        "library.removed_on_save_m": "Supprimé à l'enregistrement",
        "library.undo": "Annuler",
        "library.confirm_delete_item": "Supprimer cet élément de la bibliothèque ?",
        "library.confirm_reset_all": "Veux-tu vraiment vider TOUTE la bibliothèque ? Cette action est irréversible et supprimera tous tes Licks, Patterns et Morceaux.",

        // Commun
        "common.favorites": "Favoris",
        "common.favorite_title": "Favori",
        "common.edit": "Modifier",
        "common.delete": "Supprimer",
        "common.remove": "Supprimer",
        "common.save": "Enregistrer",
        "common.saved": "Enregistré",
        "common.saving": "Enregistrement...",
        "common.processing": "Traitement...",
        "common.cancel": "Annuler",
        "common.close": "Fermer",
        "common.back": "Retour",
        "common.add": "Ajouter",
        "common.loading": "Chargement...",

        // Historique & Tableau de bord
        "history.title": "Tableau de bord",
        "history.this_week": "Cette semaine",
        "history.this_week_title": "Voir l'évolution du temps passé",
        "history.avg_completion": "Complétion moyenne",
        "history.current_streak": "Série actuelle",
        "history.streak_unit": "{count} j",
        "history.top_key": "Meilleure tonalité",
        "history.top_key_title": "Voir la répartition des tonalités",
        "history.recent_sessions": "Dernières séances",
        "history.show_btn": "Afficher",
        "history.last_10": "10 dernières",
        "history.last_20": "20 dernières",
        "history.last_50": "50 dernières",
        "history.all": "Toutes",
        "history.no_sessions": "Aucune séance terminée pour le moment.",
        "history.unknown_date": "Date inconnue",
        "history.confirm_delete_session": "Supprimer cette séance de l'historique ?",
        "history.confirm_reset_history": "Veux-tu vraiment effacer tout l'historique ?",

        // Graphiques
        "graph.view_btn": "Vue",
        "graph.practice_time": "Temps passé",
        "graph.breakdown": "Répartition",
        "graph.breakdown_title": "Répartition du temps",
        "graph.sessions_by_key": "Séances par tonalité",
        "graph.period_btn": "Période",
        "graph.this_week": "Cette semaine",
        "graph.this_month": "Ce mois",
        "graph.this_year": "Cette année",
        "graph.all_time": "Total",
        "graph.total_hours": "Total : {hours} h",
        "graph.no_data": "Aucune donnée",
        "graph.hours_label": "Heures",
        "graph.sessions_count_label": "Nombre de séances",
        "graph.days_week": ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"],
        "graph.weeks_month": ["Semaine 1", "Semaine 2", "Semaine 3", "Semaine 4", "Semaine 5"],
        "graph.months_year": ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"],

        // Routines
        "routines.my_routines": "Mes routines",
        "routines.create_routine": "Créer une routine",
        "routines.routine_name_label": "Nom de la routine",
        "routines.routine_name_placeholder": "Ex : Échauffement Rapide",
        "routines.save_routine_btn": "Enregistrer la routine",
        "routines.no_routines": "Aucune routine enregistrée.",
        "routines.confirm_delete": "Supprimer définitivement cette routine ?",

        // Setlists & iReal Pro
        "setlists.my_setlists": "Mes setlists",
        "setlists.new_setlist": "Nouvelle setlist",
        "setlists.name_label": "Nom de la setlist",
        "setlists.name_placeholder": "Ex: Concert Jazz Club...",
        "setlists.tunes_label": "Morceaux",
        "setlists.search_placeholder": "Rechercher pour ajouter...",
        "setlists.no_setlists": "Aucune setlist existante.",
        "setlists.launch_live_title": "Lancer en Mode Live",
        "setlists.edit_prefix": "Modifier : {name}",
        "setlists.search_hint": "Recherchez un morceau ci-dessus pour l'ajouter.",
        "setlists.no_tunes_found": "Aucun morceau trouvé.",
        "setlists.alert_name_required": "Veuillez donner un nom à la setlist.",
        "setlists.alert_select_tune": "Veuillez sélectionner au moins un morceau.",
        "setlists.saved_btn": "Terminée",
        "setlists.confirm_delete": "Supprimer la setlist \"{name}\" ?",
        "setlists.ireal_default_name": "Setlist iReal Pro",
        "setlists.ireal_prompt_name": "Nom de cette Setlist iReal Pro ?",
        "setlists.ireal_no_valid": "Aucun morceau iReal Pro valide trouvé.",

        // Mode Concert / Live & Lecteur de Partition
        "concert.open_setlist_title": "Ouvrir la setlist",
        "concert.back_to_setlist": "Retourner à la setlist",
        "concert.up_next": "Suivant : {title}",
        "concert.last_tune": "Dernier morceau",
        "concert.exit_title": "Fermer et terminer le concert",
        "concert.empty_setlist_alert": "Aucun morceau trouvé dans la setlist \"{name}\".\nAjoutez des morceaux à cette setlist dans Bibliothèque > Setlists.",
        "concert.empty_library_alert": "Aucun morceau trouvé dans la bibliothèque.",
        "concert.gig_started": "Mode Live démarré : {title}",
        "concert.live_setlist": "Setlist Live",
        "concert.setlist_prefix": "Setlist : {name}",
        "concert.drag_reorder": "Glisser pour réorganiser",
        "concert.now_playing": "En cours",
        "concert.order_updated": "Ordre de la setlist mis à jour",
        "concert.ireal_available": "Grille d'accords iReal Pro disponible",
        "concert.attaching_score": "Association de la partition...",
        "concert.score_attached": "Partition associée avec succès !",
        "concert.error_attaching": "Erreur lors de l'association",
        "concert.ended_toast": "Mode Live terminé",
        "concert.end_of_setlist": "Fin de la setlist",
        "concert.start_of_setlist": "Début de la setlist",
        "concert.tune_Step": "Morceau {current}/{total} : {title}",

        // Lecteur de Partition & Annotations
        "score.default_title": "Partition",
        "score.audio_btn_title": "Lecteur Audio / Transcribe!",
        "score.audio_active_title": "Lecteur Audio actif ({title})",
        "score.play_attached_audio": "Écouter l'audio associé",
        "score.annotate_btn_title": "Mode Annotation (Stylet / Crayon)",
        "score.close_btn_title": "Fermer la partition",
        "score.move_toolbar": "Déplacer la barre d'outils",
        "score.pen_title": "Stylo / Crayon (appui long ou re-clic pour régler l'épaisseur)",
        "score.line_title": "Ligne droite (épaisseur et couleur du stylo)",
        "score.text_title": "Insérer ou modifier du texte",
        "score.highlighter_title": "Surligneur jaune",
        "score.eraser_title": "Gomme",
        "score.color_black": "Noir / Graphite",
        "score.color_red": "Rouge",
        "score.color_blue": "Bleu",
        "score.palm_pen_only": "Stylet seul actif (rejet de la paume) — Cliquer pour réactiver le doigt",
        "score.palm_finger_pen": "Mode Doigt + Stylet — Cliquer pour activer le rejet de paume (stylet seul)",
        "score.undo_title": "Annuler le dernier trait",
        "score.clear_title": "Effacer les notes de cette page",
        "score.loading": "Chargement de la partition...",
        "score.pdf_load_error": "Impossible de charger le document PDF.",
        "score.text_drag_title": "Glisser le cadre pour déplacer",
        "score.text_placeholder": "Texte...",
        "score.text_resize_title": "Glisser le coin pour ajuster la taille",

        // Cahier de musique
        "cahier.title": "Cahier",
        "cahier.badge": "CAHIER",
        "cahier.single_staff": "Portée simple",
        "cahier.grand_staff": "Portée double",
        "cahier.header_piano": "Cahier - Portée Double",
        "cahier.header_single": "Cahier - Portée Simple",
        "cahier.add_system_title": "Ajouter une ligne de portée",
        "cahier.toggle_barlines_title": "Masquer / Afficher les barres de mesures",
        "cahier.hide_barlines": "Masquer les barres de mesures",
        "cahier.restore_barlines": "Rétablir les barres de mesures (4 mesures par système)",
        "cahier.save_btn_title": "Enregistrer le cahier",
        "cahier.max_systems_toast": "Nombre maximal de systèmes ({max}) atteint pour cette page.",
        "cahier.save_to_library": "Enregistrer dans la bibliothèque",
        "cahier.title_label": "Titre",
        "cahier.default_title": "Cahier du {date} à {time}",
        "cahier.keep_editing": "Continuer",
        "cahier.keep_editing_title": "Continuer à dessiner sur le cahier",
        "cahier.export_btn": "Exporter",
        "cahier.export_pdf_title": "Exporter le cahier en PDF",
        "cahier.saved_toast": "\"{title}\" enregistré dans la bibliothèque !",
        "cahier.save_error": "Erreur lors de l'enregistrement du cahier : {error}",
        "cahier.exported_toast": "Cahier exporté en PDF ({file}) !",
        "cahier.export_error": "Erreur lors de l'exportation du PDF : {error}",

        // Trieur Express
        "sorter.title": "Trieur Express",
        "sorter.items_left": "{count} élément(s) restant(s)",
        "sorter.current_file": "Fichier en cours :",
        "sorter.matched_item": "Fichier associé à l'élément existant :",
        "sorter.merge_desc_score": "Les données iReal Pro seront conservées. La partition sera ajoutée.",
        "sorter.merge_desc_ireal": "La grille et les infos iReal Pro seront associées au morceau existant.",
        "sorter.unlink_btn": "Dissocier et créer un nouvel élément",
        "sorter.item_title_label": "Titre de l'élément",
        "sorter.item_title_placeholder": "Ex: Autumn Leaves",
        "sorter.skip_btn": "Corbeille",
        "sorter.save_next_btn": "Enregistrer & Suivant",
        "sorter.merge_next_btn": "Fusionner & Suivant",
        "sorter.apply_all_btn": "Appliquer à tous et importer automatiquement",
        "sorter.no_valid_files": "Aucun fichier valide (PDF, image ou audio) trouvé.",
        "sorter.corrupted_error": "Fichier(s) illisible(s) ou archive corrompue.",
        "sorter.score_tag": "[Partition]",
        "sorter.confirm_apply_all": "Appliquer la catégorie et les sous-catégories sélectionnées à tous les fichiers restants et les importer automatiquement ?",
        "sorter.processing_progress": "Traitement... ({current}/{total})",
        "sorter.saving_progress": "Sauvegarde... ({current}/{total})",
        "sorter.done_btn": "Terminé !",
        "sorter.import_error": "Une erreur est survenue pendant l'importation. Vérifiez la console.",

        // Métronome
        "metro.title": "Métronome",
        "metro.active_title": "Métronome actif ({bpm} BPM) - Cliquer pour ouvrir",
        "metro.close_title": "Fermer (le son continue)",
        "metro.drag_tempo_title": "Glisser vers le haut/bas ou molette pour ajuster le tempo",
        "metro.meter_label": "Décomposition & Clave",
        "metro.quarter_title": "Débit à la Noire",
        "metro.eighth_title": "Débit à la Croche (tempo dédoublé)",
        "metro.toggle_title": "Démarrer / Arrêter le métronome",
        "metro.start_title": "Démarrer le métronome",
        "metro.stop_title": "Arrêter le métronome",
        "metro.beat_slot_title": "Temps {beat} : niveau {level} (Cliquer pour changer)",

        // Lecteur Audio / Transcribe!
        "audio.title": "Lecteur",
        "audio.player_title": "Lecteur Audio",
        "audio.play_for_item": "Écouter l'audio de {title}",
        "audio.close_title": "Fermer (le son continue)",
        "audio.rewind_title": "Reculer de 5 secondes (-5s)",
        "audio.play_pause_title": "Lecture / Pause",
        "audio.forward_title": "Avancer de 5 secondes (+5s)",
        "audio.loop_section": "BOUCLE",
        "audio.loop_toggle_title": "Activer / Désactiver la boucle",
        "audio.loop_active_title": "Boucle active (cliquer pour désactiver)",
        "audio.loop_disabled_title": "Boucle désactivée (cliquer pour activer)",
        "audio.set_a": "Poser A",
        "audio.set_b": "Poser B",
        "audio.clear_ab_title": "Effacer les repères A et B",
        "audio.loop_status_active": "Boucle : {a} → {b} ({dur}s)",
        "audio.loop_status_off": "Boucle désactivée ({dur}s)",
        "audio.loop_status_wait_b": "Point A posé à {a} (en attente de B)",
        "audio.loop_status_full": "Boucle intégrale active",
        "audio.speed_section": "VITESSE",
        "audio.mute_title": "Muet",
        "audio.track_default": "Morceau",
        "audio.file_not_found": "Fichier audio introuvable",

        // Dictaphone
        "dictaphone.title": "Dictaphone",
        "dictaphone.ready": "Prêt à enregistrer",
        "dictaphone.recording": "Enregistrement en cours...",
        "dictaphone.paused": "En pause",
        "dictaphone.cancel_title": "Annuler la prise",
        "dictaphone.start_title": "Démarrer l'enregistrement",
        "dictaphone.stop_title": "Arrêter et sauvegarder la prise",
        "dictaphone.pause_title": "Mettre en pause",
        "dictaphone.resume_title": "Reprendre l'enregistrement",
        "dictaphone.review_take": "Écouter la prise",
        "dictaphone.save_to_library": "Enregistrer dans la bibliothèque",
        "dictaphone.take_title_label": "Titre de l'enregistrement",
        "dictaphone.take_title_placeholder": "Nom de l'enregistrement...",
        "dictaphone.link_to_tune": "Associer comme audio au morceau",
        "dictaphone.link_to_named_tune": "Associer comme audio à \"{title}\"",
        "dictaphone.link_to_named_tune_title": "Remplacer ou définir l'audio de {title}",
        "dictaphone.retake": "Refaire la prise",
        "dictaphone.export": "Exporter",
        "dictaphone.export_title": "Exporter l'enregistrement sur l'appareil",
        "dictaphone.confirm_stop_close": "Un enregistrement est en cours. Voulez-vous vraiment l'interrompre et fermer ?",
        "dictaphone.confirm_discard": "Annuler l'enregistrement en cours ?",
        "dictaphone.https_required": "L'enregistrement audio n'est pas disponible dans cet environnement (nécessite HTTPS ou localhost).",
        "dictaphone.mic_error": "Impossible d'accéder au microphone : {error}",
        "dictaphone.take_name_for_tune": "{title} - Prise {date}",
        "dictaphone.take_name_default": "Enregistrement du {date} à {time}",
        "dictaphone.linked_success": "Audio associé avec succès à \"{title}\" !",
        "dictaphone.link_error": "Erreur lors de l'association de l'audio : {error}",
        "dictaphone.added_to_lib": "\"{title}\" a été ajouté à la bibliothèque dans la catégorie \"{cat}\"{sub} !",
        "dictaphone.subcat_detail": " (sous-catégorie \"{sub}\")",
        "dictaphone.save_error": "Erreur lors de l'enregistrement dans la bibliothèque : {error}",
        "dictaphone.file_prefix": "enregistrement",

        // Paramètres
        "settings.title": "Paramètres",
        "settings.tab_categories": "Catégories",
        "settings.tab_pomodoro": "Pomodoro",
        "settings.tab_audio": "Sons",
        "settings.tab_theme": "Thème",
        "settings.tab_backup": "Sauvegarde",
        "settings.cat_intro": "Personnalisez vos catégories d'exercices.",
        "settings.create_cat_label": "Créer une nouvelle catégorie",
        "settings.create_cat_placeholder": "Nom de la catégorie...",
        "settings.no_categories": "Aucune catégorie définie.",
        "settings.playlists_count": "{count} setlist(s)",
        "settings.subcats_count": "{count} sous-catégorie(s)",
        "settings.delete_cat_title": "Supprimer la catégorie \"{cat}\"",
        "settings.subcat_placeholder": "Nom de la sous-catégorie...",
        "settings.setlists_managed_notice": "Les setlists de morceaux sont gérées dans Bibliothèque > Setlists.",
        "settings.alert_enter_cat": "Veuillez saisir un nom de catégorie.",
        "settings.alert_cat_exists": "Cette catégorie existe déjà.",
        "settings.confirm_delete_cat": "Supprimer définitivement la catégorie \"{cat}\" et ses sous-catégories ?\n(Les éléments déjà enregistrés dans la bibliothèque ne seront pas supprimés)",
        "settings.alert_subcat_exists": "Cette sous-catégorie existe déjà.",
        "settings.key_of_day_label": "Tonalité du jour",
        "settings.key_of_day_desc": "Afficher le sélecteur de tonalité principale lors de la préparation d'une séance.",
        "settings.enabled": "Activée",
        "settings.hidden": "Masquée",
        "settings.restore_defaults_btn": "Rétablir les paramètres par défaut",
        "settings.confirm_restore_defaults": "Voulez-vous vraiment rétablir tous les paramètres par défaut (Catégories Jazz, Pomodoro 50/5, Sons 8-bit Jazz 100%, Métronome Bois, Thème Sombre) ?",
        "settings.restore_defaults_done": "Tous les paramètres ont été rétablis avec succès !",
        "settings.pomodoro_intro": "Configurez le rythme de travail et la durée des pauses.",
        "settings.pomodoro_work_label": "Durée de travail",
        "settings.pomodoro_break_label": "Durée de la pause",
        "settings.audio_intro": "Personnalisez les thèmes sonores des notifications et le clic du métronome.",
        "settings.audio_theme_label": "Thème sonore",
        "settings.sound_jazz": "8-bit Jazz",
        "settings.sound_classic": "Classique",
        "settings.sound_zen": "Zen",
        "settings.sound_beep": "Bip",
        "settings.test_sound_title": "Tester le son",
        "settings.master_volume_label": "Volume général",
        "settings.metro_sound_label": "Métronome",
        "settings.metro_wood": "Bois",
        "settings.metro_click": "Classique",
        "settings.metro_beep": "Bip",
        "settings.test_metro_title": "Tester le métronome",
        "settings.language_heading": "Langue de l'application",
        "settings.language_intro": "Choisissez la langue d'affichage de l'application.",
        "settings.lang_desc": "Choisissez la langue d'affichage de l'application.",
        "settings.theme_heading": "Thème visuel",
        "settings.theme_intro": "Personnalisez le thème visuel de l'application.",
        "settings.theme_dark": "Espresso Dark",
        "settings.theme_dark_desc": "Chaud, café & encre crème",
        "settings.theme_argile": "Argile",
        "settings.theme_argile_desc": "Gris chaud & terracotta",
        "settings.theme_groove": "Groove",
        "settings.theme_groove_desc": "Rétro brun & jaune moutarde",
        "settings.theme_light": "Cream",
        "settings.theme_light_desc": "Papier chaud, encre café & ambre",
        "settings.export_heading": "Exporter vos données",
        "settings.export_intro": "Mettez vos morceaux, partitions associées, routines, historique et catégories à l'abri ou transférez-les sur un autre appareil.",
        "settings.export_zip_title": "Sauvegarde complète (.zip)",
        "settings.export_zip_desc": "Recommandé — Base de données intégrale + toutes vos partitions (PDF & images)",
        "settings.export_json_title": "Sauvegarde légère (.json)",
        "settings.export_json_desc": "Base de données seule (sans les fichiers de partitions)",
        "settings.restore_heading": "Restaurer une sauvegarde",
        "settings.restore_intro": "Sélectionnez un fichier de sauvegarde (.zip ou .json) pour réimporter vos données.",
        "settings.select_backup_btn": "Sélectionner un fichier (.zip ou .json)",
        "settings.android_update_title": "Mises à jour Android sans perte de données :",
        "settings.android_update_body": "Sur Android, <strong>ne désinstallez jamais</strong> l'application avant d'installer un nouvel APK. Installez simplement le nouveau fichier APK <em>par-dessus</em> l'ancien : vos données et partitions sont ainsi conservées intactes. En cas de doute, effectuez toujours une Sauvegarde complète (.zip) avant une mise à jour !",
        "settings.backup_share_text": "Sauvegarde Jazz Trane'R : {file}",
        "settings.backup_share_dialog": "Enregistrer ou partager la sauvegarde",
        "settings.download_error": "Impossible de déclencher le téléchargement automatique : {error}",
        "settings.generating_json": "Génération de la sauvegarde JSON...",
        "settings.json_downloaded": "Sauvegarde JSON téléchargée avec succès !",
        "settings.json_error": "Erreur lors de la création de la sauvegarde JSON : {error}",
        "settings.reading_db": "Lecture de la base de données...",
        "settings.packing_files": "Ajout des partitions ({count}/{total})...",
        "settings.compressing_zip": "Compression de l'archive ZIP en cours...",
        "settings.compressing_zip_pct": "Compression ZIP : {pct}%...",
        "settings.zip_exported": "Sauvegarde complète exportée ({total} fichier(s)) !",
        "settings.zip_error": "Erreur lors de la création de la sauvegarde ZIP : {error}",
        "settings.analyzing_backup": "Analyse du fichier de sauvegarde...",
        "settings.restore_json_done": "Restauration réussie !\n\n• Éléments : {vocab}\n• Séances : {seances}\n• Routines : {routines}",
        "settings.invalid_zip_db": "Le fichier ZIP ne contient pas de fichier 'database.json' valide.",
        "settings.restoring_db": "Restauration de la base de données...",
        "settings.restoring_files": "Restauration des fichiers ({current}/{total})...",
        "settings.restore_zip_done": "Restauration complète réussie !\n\n• Éléments : {vocab}\n• Séances : {seances}\n• Routines : {routines}\n• Fichiers médias restaurés : {files}",
        "settings.unrecognized_backup": "Format non reconnu. Veuillez choisir un fichier .zip ou .json.",
        "settings.restore_success_msg": "Restauration terminée avec succès !",
        "settings.restore_error": "Une erreur est survenue lors de la lecture du fichier de sauvegarde : {error}",
        "notif.channel_name": "Chronomètre & Alertes",
        "notif.channel_desc": "Alertes sonores à la fin des exercices et des pauses",

        // Clés complémentaires pour script.js & DOM
        "audio.full_loop_active": "Boucle complète active",
        "audio.listen_item_title": "Écouter l'audio associé : {title}",
        "audio.loop_a_waiting_b": "Point A posé ({a}) — en attente du point B",
        "audio.loop_range_status": "Boucle : {a} → {b} ({dur}s)",
        "audio.loop_disabled_status": "Boucle désactivée ({dur}s)",
        "audio.loop_inactive_title": "Activer la boucle A-B",
        "audio.player_active_title": "Lecteur audio en cours : {title}",
        "common.favorite": "Favori",
        "common.file": "Fichier",
        "common.reorder": "Glisser pour réorganiser",
        "common.resource": "Ressource",
        "common.untitled": "Sans titre",
        "creation.choose_category_alert": "Veuillez d'abord choisir une catégorie.",
        "dictaphone.add_lib_error": "Erreur lors de l'enregistrement dans la bibliothèque : {err}",
        "dictaphone.added_lib_success": "\"{title}\" enregistré avec succès dans la bibliothèque ({cat}{sub}) !",
        "dictaphone.confirm_abort_close": "Un enregistrement est en cours. Voulez-vous vraiment l'interrompre et fermer le dictaphone ?",
        "dictaphone.confirm_cancel_rec": "Voulez-vous vraiment annuler et effacer cet enregistrement ?",
        "dictaphone.default_title": "Prise du {date} à {time}",
        "dictaphone.default_title_with_item": "{title} - Prise du {date}",
        "dictaphone.link_to_item_btn": "Associer à \"{title}\"",
        "dictaphone.link_to_item_title": "Associer directement cet enregistrement audio au morceau en cours : {title}",
        "dictaphone.mic_error_alert": "Impossible d'accéder au microphone : {err}",
        "dictaphone.pause_rec": "Mettre en pause l'enregistrement",
        "dictaphone.rec_active_btn": "Enregistrement en cours (Dictaphone)",
        "dictaphone.rec_idle_btn": "Dictaphone (Enregistreur)",
        "dictaphone.resume_rec": "Reprendre l'enregistrement",
        "dictaphone.saving": "Enregistrement en cours...",
        "dictaphone.start_rec": "Démarrer l'enregistrement",
        "dictaphone.stop_save_rec": "Arrêter et conserver la prise",
        "dictaphone.unavailable_alert": "L'enregistrement audio n'est pas pris en charge par votre navigateur ou votre appareil.",
        "history.chart_sessions_key": "Séances par tonalité",
        "history.chart_time_dist": "Répartition du temps de travail",
        "history.chart_time_spent": "Temps de pratique",
        "history.confirm_reset_all": "Êtes-vous sûr de vouloir réinitialiser tout l'historique ? Cette action est irréversible.",
        "history.days_unit": "j",
        "history.days_week": ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
        "history.empty": "Aucune séance enregistrée pour le moment.",
        "history.hours_label": "Heures",
        "history.months_year": ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"],
        "history.no_data": "Aucune donnée",
        "history.sessions_count": "Nombre de séances",
        "history.total_hours": "Total : {hours} h",
        "history.weeks_month": ["Semaine 1", "Semaine 2", "Semaine 3", "Semaine 4", "Semaine 5"],
        "immersive.already_practiced": "Déjà pratiqué ! (Cliquer pour annuler)",
        "immersive.done_badge": "TERMINÉ",
        "immersive.exit_title": "Quitter le mode immersif",
        "immersive.finish": "Terminer",
        "immersive.free_exercise": "Exercice libre",
        "immersive.mark_practiced": "Marquer comme bossé",
        "immersive.no_matching_item": "Aucun morceau ne correspond dans cette catégorie.",
        "immersive.pause": "Pause",
        "immersive.paused_overtime": "En pause (+ {time})",
        "immersive.paused_time": "En pause ({time})",
        "immersive.resume": "Reprendre",
        "immersive.search_placeholder": "Rechercher dans la séance...",
        "ireal.default_setlist_name": "Setlist iReal Pro",
        "ireal.no_tunes_found": "Aucun morceau iReal Pro trouvé.",
        "ireal.no_valid_tunes": "Aucun morceau iReal Pro valide n'a pu être extrait.",
        "ireal.prompt_setlist_name": "Nom de cette Setlist iReal Pro ?",
        "library.audio_linked_info": "Audio associé : {name}",
        "library.click_enlarge": "Cliquer pour agrandir",
        "library.delete_audio_title": "Supprimer l'audio associé",
        "library.delete_score_title": "Supprimer la partition associée",
        "library.deleted_on_save_audio": "L'audio sera supprimé lors de l'enregistrement",
        "library.deleted_on_save_score": "La partition sera supprimée lors de l'enregistrement",
        "library.empty": "Aucun élément dans la bibliothèque.",
        "library.listen_audio_title": "Écouter l'audio",
        "library.open_pdf": "Ouvrir la partition PDF",
        "library.open_pdf_score": "Ouvrir la partition PDF",
        "library.score_default": "Partition",
        "library.score_linked_info": "Partition : {name}",
        "metronome.active_title": "Métronome actif ({bpm} BPM)",
        "metronome.beat_slot_title": "Temps {beat} — Clic pour changer d'accentuation (Niveau {lvl})",
        "metronome.start": "Démarrer le métronome",
        "metronome.stop": "Arrêter le métronome",
        "metronome.title": "Métronome",
        "practice.afk_alert": "Séance clôturée automatiquement : inactivité prolongée détectée. Vos exercices ont été enregistrés dans l'historique.",
        "practice.break_prompt": "Petite pause ?",
        "practice.cancel_break": "Annuler la pause",
        "practice.exercise_fallback": "Exercice",
        "practice.finish_session": "Terminer la séance",
        "practice.main_key": "Tonalité principale : {key}",
        "practice.session_finished": "Séance terminée",
        "practice.session_finished_saved": "Séance terminée et sauvegardée",
        "practice.session_of": "Séance du {date}",
        "practice.timer_done_body": "Temps écoulé : {name}",
        "routines.create_title": "Nouvelle routine",
        "routines.empty": "Aucune routine enregistrée.",
        "setlists.alert_enter_name": "Veuillez saisir un nom pour la setlist.",
        "setlists.empty": "Aucune setlist existante.",
        "setlists.live_btn": "Live",
        "setlists.new_title": "Nouvelle setlist",
        "setlists.no_tune_found": "Aucun morceau trouvé.",
        "setlists.saved_done": "Terminée",
        "setlists.search_prompt_empty": "Recherchez un morceau ci-dessus pour l'ajouter.",
        "setlists.title": "Mes setlists"
    },

    en: {
        // Navigation
        "nav.logo_aria": "Jazz Trane'R Logo",
        "nav.back_to_session": "Back to session",
        "nav.settings": "Settings",
        "nav.metronome": "Metronome",
        "nav.practice": "Practice",
        "nav.history": "History",
        "nav.library": "Library",
        "nav.new_session_title": "Session routine",
        "nav.session": "Session",

        // Practice View
        "practice.break_title": "Take a breather?",
        "practice.cancel_break_title": "Cancel break",
        "practice.pause_resume_title": "Pause / Resume",
        "practice.loading": "Loading...",
        "practice.end_session": "End Session",
        "practice.save": "Save",
        "practice.discard_stats_title": "Discard session stats",
        "practice.session_of_date": "Session — {date}",
        "practice.key_of_day": "Key of the Day: {key}",
        "practice.resource": "Resource",
        "practice.reorder": "Reorder",
        "practice.exercise_default": "Exercise",
        "practice.timer_done_title": "Timer Complete!",
        "practice.time_up_item": "Time's up: {name}",
        "practice.time_up_body": "Time's up, exercise complete!",
        "practice.time_up_short": "Time's up!",
        "practice.break_done_title": "Break's Over!",
        "practice.break_done_body": "Ready to get back to the shed?",
        "practice.session_completed_saved": "Session Completed & Saved",
        "practice.session_ended": "Session Ended",
        "practice.afk_auto_closed": "Session automatically closed: over 1 hour of inactivity detected during overtime. Your completed exercises have been saved to your history.",
        "practice.done": "Done",
        "practice.finish": "Finish",
        "practice.pause": "Pause",
        "practice.resume": "Resume",
        "practice.paused_overtime": "Paused (+ {time})",
        "practice.paused_time": "Paused ({time})",
        "practice.mark_practiced": "Mark as practiced",
        "practice.already_practiced_undo": "Practiced! (Click to undo)",
        "practice.free_practice": "Open Practice",
        "practice.no_matching_items": "No matching items found.",
        "practice.exit_focus_mode": "Exit Focus Mode",

        // Session Builder View
        "creation.title": "Session Builder",
        "creation.key_section": "Key of the Day",
        "creation.random_key": "Random Key",
        "creation.add_exercise_section": "Add Practice Item",
        "creation.details_btn": "+ Details...",
        "creation.details_placeholder": "Specific focus, tempo, keys, variations...",
        "creation.sub_5_min": "Subtract 5 minutes",
        "creation.swipe_time_title": "Swipe up/down or scroll to adjust duration",
        "creation.minutes_label": "MINUTES",
        "creation.add_5_min": "Add 5 minutes",
        "creation.add_to_session": "Add to Session",
        "creation.update_exercise": "Update Practice Item",
        "creation.session_section": "Session Lineup",
        "creation.import_routine_title": "Load a routine",
        "creation.save_routine_title": "Save current lineup as a routine",
        "creation.save_session_btn": "Start Session",
        "creation.alert_choose_category": "Please select a category first.",

        // Library View
        "library.title": "Music Library",
        "library.reset": "Reset",
        "library.add_section": "Add to Library",
        "library.import_sort_title": "Batch import files (ZIP or multiple PDFs/images/audio) via Quick Sorter",
        "library.import_sort_btn": "Import & Sort",
        "library.dictaphone_title": "Voice Recorder (Practice Tape)",
        "library.dictaphone_rec_title": "Recording in progress (Recorder)",
        "library.notebook_title": "Notebook",
        "library.item_name_label": "Item Title",
        "library.item_name_placeholder": "Title...",
        "library.category_label": "Category",
        "library.subcategory_label": "Subcategory",
        "library.score_label": "Add Score",
        "library.choose_files": "Choose files",
        "library.choose_file": "Choose file",
        "library.no_file_chosen": "No file chosen",
        "library.files_selected": "{count} files selected",
        "library.audio_label": "Add Audio",
        "library.add_btn": "Add",
        "library.setlists_btn": "Setlists",
        "library.search_placeholder": "Search...",
        "library.fav_filter_title": "Show favorites only",
        "library.filter_btn": "Filter",
        "library.all_categories": "All Categories",
        "library.sort_btn": "Sort",
        "library.sort_az": "A to Z",
        "library.sort_za": "Z to A",
        "library.sort_most": "Most practiced",
        "library.sort_least": "Least practiced",
        "library.loading": "Loading library...",
        "library.no_items": "No items found.",
        "library.untitled": "Untitled",
        "library.practiced_count": "Practiced {count} time(s)",
        "library.play_backing_title": "Play track / backing track",
        "library.open_pdf_title": "Open PDF",
        "library.open_pdf_score_title": "Open PDF score",
        "library.click_enlarge_title": "Click to enlarge",
        "library.score_badge": "Lead Sheet",
        "library.current_cat_suffix": "{type} (current)",
        "library.file_default": "File",
        "library.score_pages_info": "Score ({count} p.): {name}",
        "library.score_attached_info": "Attached score: {name}",
        "library.remove_score_title": "Remove score",
        "library.audio_attached_info": "Attached audio: {name}",
        "library.remove_audio_title": "Remove audio",
        "library.removed_on_save_f": "Will be removed on save",
        "library.removed_on_save_m": "Will be removed on save",
        "library.undo": "Undo",
        "library.confirm_delete_item": "Delete this item from your library?",
        "library.confirm_reset_all": "Are you sure you want to clear your ENTIRE library? This cannot be undone and will delete all your Licks, Patterns, and Tunes.",

        // Common
        "common.favorites": "Favorites",
        "common.favorite_title": "Favorite",
        "common.edit": "Edit",
        "common.delete": "Delete",
        "common.remove": "Remove",
        "common.save": "Save",
        "common.saved": "Saved",
        "common.saving": "Saving...",
        "common.processing": "Processing...",
        "common.cancel": "Cancel",
        "common.close": "Close",
        "common.back": "Back",
        "common.add": "Add",
        "common.loading": "Loading...",

        // History & Dashboard
        "history.title": "Dashboard",
        "history.this_week": "This Week",
        "history.this_week_title": "View practice time trends",
        "history.avg_completion": "Avg. Completion",
        "history.current_streak": "Current Streak",
        "history.streak_unit": "{count} d",
        "history.top_key": "Top Key",
        "history.top_key_title": "View key center breakdown",
        "history.recent_sessions": "Recent Sessions",
        "history.show_btn": "Show",
        "history.last_10": "Last 10",
        "history.last_20": "Last 20",
        "history.last_50": "Last 50",
        "history.all": "All",
        "history.no_sessions": "No completed sessions yet.",
        "history.unknown_date": "Unknown date",
        "history.confirm_delete_session": "Delete this session from your history?",
        "history.confirm_reset_history": "Are you sure you want to clear your entire session history?",

        // Charts
        "graph.view_btn": "View",
        "graph.practice_time": "Practice Time",
        "graph.breakdown": "Breakdown",
        "graph.breakdown_title": "Practice Breakdown",
        "graph.sessions_by_key": "Sessions by Key",
        "graph.period_btn": "Period",
        "graph.this_week": "This Week",
        "graph.this_month": "This Month",
        "graph.this_year": "This Year",
        "graph.all_time": "All Time",
        "graph.total_hours": "Total: {hours} hrs",
        "graph.no_data": "No data",
        "graph.hours_label": "Hours",
        "graph.sessions_count_label": "Sessions",
        "graph.days_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "graph.weeks_month": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
        "graph.months_year": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],

        // Routines
        "routines.my_routines": "My Routines",
        "routines.create_routine": "Save as Routine",
        "routines.routine_name_label": "Routine Name",
        "routines.routine_name_placeholder": "e.g., Daily Shed / Bebop Warm-up",
        "routines.save_routine_btn": "Save Routine",
        "routines.no_routines": "No saved routines yet.",
        "routines.confirm_delete": "Permanently delete this routine?",

        // Setlists & iReal Pro
        "setlists.my_setlists": "My Setlists",
        "setlists.new_setlist": "New Setlist",
        "setlists.name_label": "Setlist Name",
        "setlists.name_placeholder": "e.g., Friday Night Gig, Jam Session...",
        "setlists.tunes_label": "Tunes",
        "setlists.search_placeholder": "Search tunes to add...",
        "setlists.no_setlists": "No setlists yet.",
        "setlists.launch_live_title": "Launch Live Gig Mode",
        "setlists.edit_prefix": "Edit: {name}",
        "setlists.search_hint": "Search for a tune above to add it.",
        "setlists.no_tunes_found": "No tunes found.",
        "setlists.alert_name_required": "Please enter a setlist name.",
        "setlists.alert_select_tune": "Please select at least one tune.",
        "setlists.saved_btn": "Saved",
        "setlists.confirm_delete": "Delete setlist \"{name}\"?",
        "setlists.ireal_default_name": "iReal Pro Setlist",
        "setlists.ireal_prompt_name": "Name for this iReal Pro Setlist?",
        "setlists.ireal_no_valid": "No valid iReal Pro tunes found.",

        // Live Gig Mode & Score Viewer
        "concert.open_setlist_title": "Open setlist",
        "concert.back_to_setlist": "Back to setlist",
        "concert.up_next": "Up next: {title}",
        "concert.last_tune": "Last tune",
        "concert.exit_title": "Exit Live Gig Mode",
        "concert.empty_setlist_alert": "No tunes found in setlist \"{name}\".\nAdd tunes to this setlist in Library > Setlists.",
        "concert.empty_library_alert": "No tunes found in the library.",
        "concert.gig_started": "Live Mode started: {title}",
        "concert.live_setlist": "Live Setlist",
        "concert.setlist_prefix": "Setlist: {name}",
        "concert.drag_reorder": "Drag to reorder",
        "concert.now_playing": "Playing",
        "concert.order_updated": "Setlist order updated",
        "concert.ireal_available": "iReal Pro chord chart available",
        "concert.attaching_score": "Attaching score...",
        "concert.score_attached": "Score attached!",
        "concert.error_attaching": "Error attaching score",
        "concert.ended_toast": "Live Mode ended",
        "concert.end_of_setlist": "End of setlist",
        "concert.start_of_setlist": "Start of setlist",
        "concert.tune_Step": "Tune {current}/{total}: {title}",

        // Score Viewer & Annotations
        "score.default_title": "Lead Sheet",
        "score.audio_btn_title": "Audio Player / Transcribe!",
        "score.audio_active_title": "Audio Player active ({title})",
        "score.play_attached_audio": "Play attached audio",
        "score.annotate_btn_title": "Annotation Mode (Stylus / Pen)",
        "score.close_btn_title": "Close score",
        "score.move_toolbar": "Move toolbar",
        "score.pen_title": "Pen / Pencil (long press or tap again to adjust thickness)",
        "score.line_title": "Straight line (uses pen thickness & color)",
        "score.text_title": "Insert or edit text",
        "score.highlighter_title": "Highlighter",
        "score.eraser_title": "Eraser",
        "score.color_black": "Black / Graphite",
        "score.color_red": "Red",
        "score.color_blue": "Blue",
        "score.palm_pen_only": "Stylus Only (Palm Rejection On) — Click to allow finger drawing",
        "score.palm_finger_pen": "Finger + Stylus Mode — Click to enable Palm Rejection (stylus only)",
        "score.undo_title": "Undo last stroke",
        "score.clear_title": "Clear all annotations on this page",
        "score.loading": "Loading score...",
        "score.pdf_load_error": "Could not load PDF document.",
        "score.text_drag_title": "Drag frame to move",
        "score.text_placeholder": "Text...",
        "score.text_resize_title": "Drag corner to resize",

        // Manuscript Notebook (Cahier)
        "cahier.title": "Notebook",
        "cahier.badge": "NOTEBOOK",
        "cahier.single_staff": "Single Staff",
        "cahier.grand_staff": "Double Staff",
        "cahier.header_piano": "Notebook - Double Staff",
        "cahier.header_single": "Notebook - Single Staff",
        "cahier.add_system_title": "Add staff system",
        "cahier.toggle_barlines_title": "Show / Hide barlines",
        "cahier.hide_barlines": "Hide barlines",
        "cahier.restore_barlines": "Restore barlines (4 bars per system)",
        "cahier.save_btn_title": "Save manuscript page",
        "cahier.max_systems_toast": "Maximum number of systems ({max}) reached for this page.",
        "cahier.save_to_library": "Save to Library",
        "cahier.title_label": "Title",
        "cahier.default_title": "Manuscript — {date} at {time}",
        "cahier.keep_editing": "Keep Editing",
        "cahier.keep_editing_title": "Keep writing on staff paper",
        "cahier.export_btn": "Export PDF",
        "cahier.export_pdf_title": "Export manuscript as PDF",
        "cahier.saved_toast": "\"{title}\" saved to library!",
        "cahier.save_error": "Error saving manuscript: {error}",
        "cahier.exported_toast": "Manuscript exported as PDF ({file})!",
        "cahier.export_error": "Error exporting PDF: {error}",

        // Quick Sorter (Trieur Express)
        "sorter.title": "Quick Sorter",
        "sorter.items_left": "{count} item(s) left",
        "sorter.current_file": "Current file:",
        "sorter.matched_item": "Matched with existing library item:",
        "sorter.merge_desc_score": "Existing iReal Pro data will be kept. The score will be attached.",
        "sorter.merge_desc_ireal": "The iReal Pro chord chart and metadata will be linked to the existing tune.",
        "sorter.unlink_btn": "Unlink and create a new item",
        "sorter.item_title_label": "Item Title",
        "sorter.item_title_placeholder": "e.g., Autumn Leaves",
        "sorter.skip_btn": "Skip",
        "sorter.save_next_btn": "Save & Next",
        "sorter.merge_next_btn": "Merge & Next",
        "sorter.apply_all_btn": "Apply to all & auto-import remaining",
        "sorter.no_valid_files": "No valid files (PDF, image, or audio) found.",
        "sorter.corrupted_error": "Unreadable file(s) or corrupted archive.",
        "sorter.score_tag": "[Score]",
        "sorter.confirm_apply_all": "Apply the selected category and subcategories to all remaining files and import them automatically?",
        "sorter.processing_progress": "Processing... ({current}/{total})",
        "sorter.saving_progress": "Saving... ({current}/{total})",
        "sorter.done_btn": "Done!",
        "sorter.import_error": "An error occurred during import. Check the console for details.",

        // Metronome
        "metro.title": "Metronome",
        "metro.active_title": "Metronome active ({bpm} BPM) - Click to open",
        "metro.close_title": "Close (metronome keeps playing)",
        "metro.drag_tempo_title": "Drag up/down or scroll to adjust tempo",
        "metro.meter_label": "Decomposition & Clave",
        "metro.quarter_title": "Quarter-note subdivision",
        "metro.eighth_title": "Eighth-note subdivision",
        "metro.toggle_title": "Start / Stop metronome",
        "metro.start_title": "Start metronome",
        "metro.stop_title": "Stop metronome",
        "metro.beat_slot_title": "Beat {beat}: level {level} (Click to cycle)",

        // Audio Player / Transcribe!
        "audio.title": "Audio Player",
        "audio.player_title": "Audio Player",
        "audio.play_for_item": "Play audio for {title}",
        "audio.close_title": "Close (audio keeps playing)",
        "audio.rewind_title": "Rewind 5 seconds (-5s)",
        "audio.play_pause_title": "Play / Pause",
        "audio.forward_title": "Forward 5 seconds (+5s)",
        "audio.loop_section": "A–B LOOP",
        "audio.loop_toggle_title": "Toggle A–B Loop",
        "audio.loop_active_title": "Loop active (click to disable)",
        "audio.loop_disabled_title": "Loop disabled (click to enable)",
        "audio.set_a": "Set A",
        "audio.set_b": "Set B",
        "audio.clear_ab_title": "Clear A & B loop points",
        "audio.loop_status_active": "Loop: {a} → {b} ({dur}s)",
        "audio.loop_status_off": "Loop disabled ({dur}s)",
        "audio.loop_status_wait_b": "Point A set at {a} (waiting for B)",
        "audio.loop_status_full": "Full track loop active",
        "audio.speed_section": "SPEED",
        "audio.mute_title": "Mute",
        "audio.track_default": "Track",
        "audio.file_not_found": "Audio file not found",

        // Recorder (Dictaphone)
        "dictaphone.title": "Recorder",
        "dictaphone.ready": "Ready to record",
        "dictaphone.recording": "Recording...",
        "dictaphone.paused": "Paused",
        "dictaphone.cancel_title": "Discard take",
        "dictaphone.start_title": "Start recording",
        "dictaphone.stop_title": "Stop and review take",
        "dictaphone.pause_title": "Pause recording",
        "dictaphone.resume_title": "Resume recording",
        "dictaphone.review_take": "Review Take",
        "dictaphone.save_to_library": "Save to Library",
        "dictaphone.take_title_label": "Take Title",
        "dictaphone.take_title_placeholder": "Take name...",
        "dictaphone.link_to_tune": "Link as audio to current tune",
        "dictaphone.link_to_named_tune": "Link as audio to \"{title}\"",
        "dictaphone.link_to_named_tune_title": "Replace or set audio for {title}",
        "dictaphone.retake": "New Take",
        "dictaphone.export": "Export",
        "dictaphone.export_title": "Download audio take to device",
        "dictaphone.confirm_stop_close": "A recording is in progress. Do you really want to stop and close?",
        "dictaphone.confirm_discard": "Discard current recording?",
        "dictaphone.https_required": "Audio recording is not available in this environment (requires HTTPS or localhost).",
        "dictaphone.mic_error": "Could not access microphone: {error}",
        "dictaphone.take_name_for_tune": "{title} - Take {date}",
        "dictaphone.take_name_default": "Recording {date} at {time}",
        "dictaphone.linked_success": "Audio successfully linked to \"{title}\"!",
        "dictaphone.link_error": "Error linking audio: {error}",
        "dictaphone.added_to_lib": "\"{title}\" was added to the library under \"{cat}\"{sub}!",
        "dictaphone.subcat_detail": " (subcategory \"{sub}\")",
        "dictaphone.save_error": "Error saving to library: {error}",
        "dictaphone.file_prefix": "recording",

        // Settings
        "settings.title": "Settings",
        "settings.tab_categories": "Categories",
        "settings.tab_pomodoro": "Pomodoro",
        "settings.tab_audio": "Audio",
        "settings.tab_theme": "Theme",
        "settings.tab_backup": "Backup",
        "settings.cat_intro": "Customize your practice categories and subcategories.",
        "settings.create_cat_label": "Create a new category",
        "settings.create_cat_placeholder": "Category name...",
        "settings.no_categories": "No categories defined.",
        "settings.playlists_count": "{count} setlist(s)",
        "settings.subcats_count": "{count} subcategor{plural}",
        "settings.delete_cat_title": "Delete category \"{cat}\"",
        "settings.subcat_placeholder": "Subcategory name...",
        "settings.setlists_managed_notice": "Tune setlists are managed in Library > Setlists.",
        "settings.alert_enter_cat": "Please enter a category name.",
        "settings.alert_cat_exists": "This category already exists.",
        "settings.confirm_delete_cat": "Permanently delete category \"{cat}\" and its subcategories?\n(Items already saved in your library will not be deleted)",
        "settings.alert_subcat_exists": "This subcategory already exists.",
        "settings.key_of_day_label": "Key of the Day",
        "settings.key_of_day_desc": "Show the Key of the Day selector when building a practice session.",
        "settings.enabled": "Enabled",
        "settings.hidden": "Hidden",
        "settings.restore_defaults_btn": "Restore default settings",
        "settings.confirm_restore_defaults": "Restore all default settings (Jazz Categories, 50/5 Pomodoro, 8-bit Jazz Audio 100%, Woodblock Metronome, Dark Theme)?",
        "settings.restore_defaults_done": "All settings have been restored to defaults!",
        "settings.pomodoro_intro": "Set your practice work intervals and break durations.",
        "settings.pomodoro_work_label": "Work Interval",
        "settings.pomodoro_break_label": "Break Duration",
        "settings.audio_intro": "Customize timer alert sounds and metronome click tone.",
        "settings.audio_theme_label": "Timer Alert Sound",
        "settings.sound_jazz": "8-bit Jazz",
        "settings.sound_classic": "Classic Arpeggio",
        "settings.sound_zen": "Zen Bowl",
        "settings.sound_beep": "Digital Beep",
        "settings.test_sound_title": "Preview sound",
        "settings.master_volume_label": "Master Volume",
        "settings.metro_sound_label": "Metronome Click",
        "settings.metro_wood": "Woodblock",
        "settings.metro_click": "Mechanical Click",
        "settings.metro_beep": "Electronic Beep",
        "settings.test_metro_title": "Preview metronome",
        "settings.language_heading": "App Language",
        "settings.language_intro": "Choose the application display language.",
        "settings.lang_desc": "Choose the application display language.",
        "settings.theme_heading": "Visual Theme",
        "settings.theme_intro": "Customize the visual theme of the application.",
        "settings.theme_dark": "Espresso Dark",
        "settings.theme_dark_desc": "Warm coffee, amber & cream ink",
        "settings.theme_argile": "Argile (Clay)",
        "settings.theme_argile_desc": "Warm gray & terracotta",
        "settings.theme_groove": "Groove",
        "settings.theme_groove_desc": "Retro brown & mustard yellow",
        "settings.theme_light": "Cream",
        "settings.theme_light_desc": "Warm paper, coffee ink & amber",
        "settings.export_heading": "Export Your Data",
        "settings.export_intro": "Back up your tunes, lead sheets, audio files, routines, practice log, and categories, or transfer them to another device.",
        "settings.export_zip_title": "Full Backup (.zip)",
        "settings.export_zip_desc": "Recommended — Complete database + all your scores & audio files",
        "settings.export_json_title": "Lightweight Backup (.json)",
        "settings.export_json_desc": "Database only (without PDF/image/audio files)",
        "settings.restore_heading": "Restore a Backup",
        "settings.restore_intro": "Select a backup file (.zip or .json) to restore your library and history.",
        "settings.select_backup_btn": "Select Backup File (.zip or .json)",
        "settings.android_update_title": "Lossless Android Updates:",
        "settings.android_update_body": "On Android, <strong>never uninstall</strong> the app before installing a new APK. Simply install the new APK <em>over</em> the existing one to keep all your data and scores intact. When in doubt, always export a Full Backup (.zip) before updating!",
        "settings.backup_share_text": "Jazz Trane'R Backup: {file}",
        "settings.backup_share_dialog": "Save or share backup",
        "settings.download_error": "Could not trigger automatic download: {error}",
        "settings.generating_json": "Generating JSON backup...",
        "settings.json_downloaded": "JSON backup downloaded!",
        "settings.json_error": "Error creating JSON backup: {error}",
        "settings.reading_db": "Reading database...",
        "settings.packing_files": "Packing scores & audio ({count}/{total})...",
        "settings.compressing_zip": "Compressing ZIP archive...",
        "settings.compressing_zip_pct": "ZIP compression: {pct}%...",
        "settings.zip_exported": "Full backup exported ({total} file(s))!",
        "settings.zip_error": "Error creating ZIP backup: {error}",
        "settings.analyzing_backup": "Analyzing backup file...",
        "settings.restore_json_done": "Restore complete!\n\n• Library items: {vocab}\n• Sessions: {seances}\n• Routines: {routines}",
        "settings.invalid_zip_db": "The ZIP archive does not contain a valid 'database.json' file.",
        "settings.restoring_db": "Restoring database...",
        "settings.restoring_files": "Restoring media files ({current}/{total})...",
        "settings.restore_zip_done": "Full restore complete!\n\n• Library items: {vocab}\n• Sessions: {seances}\n• Routines: {routines}\n• Media files restored: {files}",
        "settings.unrecognized_backup": "Unrecognized format. Please select a .zip or .json file.",
        "settings.restore_success_msg": "Restore completed successfully!",
        "settings.restore_error": "An error occurred while reading the backup file: {error}",
        "notif.channel_name": "Practice Timer & Alerts",
        "notif.channel_desc": "Sound alerts when exercises and breaks end",

        // Supplementary keys for script.js & DOM
        "audio.full_loop_active": "Full loop active",
        "audio.listen_item_title": "Listen to attached audio: {title}",
        "audio.loop_a_waiting_b": "Point A set ({a}) — waiting for point B",
        "audio.loop_range_status": "Loop: {a} → {b} ({dur}s)",
        "audio.loop_disabled_status": "Loop disabled ({dur}s)",
        "audio.loop_inactive_title": "Enable A-B loop",
        "audio.player_active_title": "Audio player playing: {title}",
        "common.favorite": "Favorite",
        "common.file": "File",
        "common.reorder": "Drag to reorder",
        "common.resource": "Resource",
        "common.untitled": "Untitled",
        "creation.choose_category_alert": "Please select a category first.",
        "dictaphone.add_lib_error": "Error saving to library: {err}",
        "dictaphone.added_lib_success": "\"{title}\" successfully saved to library ({cat}{sub})!",
        "dictaphone.confirm_abort_close": "A recording is in progress. Do you really want to discard it and close the dictaphone?",
        "dictaphone.confirm_cancel_rec": "Do you really want to discard this recording?",
        "dictaphone.default_title": "Take of {date} at {time}",
        "dictaphone.default_title_with_item": "{title} - Take of {date}",
        "dictaphone.link_to_item_btn": "Attach to \"{title}\"",
        "dictaphone.link_to_item_title": "Attach this audio recording directly to current tune: {title}",
        "dictaphone.mic_error_alert": "Could not access microphone: {err}",
        "dictaphone.pause_rec": "Pause recording",
        "dictaphone.rec_active_btn": "Recording in progress (Dictaphone)",
        "dictaphone.rec_idle_btn": "Dictaphone (Recorder)",
        "dictaphone.resume_rec": "Resume recording",
        "dictaphone.saving": "Saving...",
        "dictaphone.start_rec": "Start recording",
        "dictaphone.stop_save_rec": "Stop and save take",
        "dictaphone.unavailable_alert": "Audio recording is not supported by your browser or device.",
        "history.chart_sessions_key": "Sessions by Key",
        "history.chart_time_dist": "Practice Time Breakdown",
        "history.chart_time_spent": "Practice Time",
        "history.confirm_reset_all": "Are you sure you want to reset all practice history? This action cannot be undone.",
        "history.days_unit": "d",
        "history.days_week": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "history.empty": "No practice sessions recorded yet.",
        "history.hours_label": "Hours",
        "history.months_year": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        "history.no_data": "No data",
        "history.sessions_count": "Session count",
        "history.total_hours": "Total: {hours} hrs",
        "history.weeks_month": ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"],
        "immersive.already_practiced": "Practiced! (Click to undo)",
        "immersive.done_badge": "DONE",
        "immersive.exit_title": "Exit focus mode",
        "immersive.finish": "Finish",
        "immersive.free_exercise": "Free practice",
        "immersive.mark_practiced": "Mark as practiced",
        "immersive.no_matching_item": "No matching tunes in this category.",
        "immersive.pause": "Pause",
        "immersive.paused_overtime": "Paused (+ {time})",
        "immersive.paused_time": "Paused ({time})",
        "immersive.resume": "Resume",
        "immersive.search_placeholder": "Search in session...",
        "ireal.default_setlist_name": "iReal Pro Setlist",
        "ireal.no_tunes_found": "No iReal Pro tunes found.",
        "ireal.no_valid_tunes": "No valid iReal Pro tunes could be parsed.",
        "ireal.prompt_setlist_name": "Name of this iReal Pro Setlist?",
        "library.audio_linked_info": "Attached audio: {name}",
        "library.click_enlarge": "Click to enlarge",
        "library.delete_audio_title": "Remove attached audio",
        "library.delete_score_title": "Remove attached score",
        "library.deleted_on_save_audio": "Audio will be deleted upon saving",
        "library.deleted_on_save_score": "Score will be deleted upon saving",
        "library.empty": "No items in library.",
        "library.listen_audio_title": "Listen to audio",
        "library.open_pdf": "Open PDF score",
        "library.open_pdf_score": "Open PDF score",
        "library.score_default": "Score",
        "library.score_linked_info": "Score: {name}",
        "metronome.active_title": "Metronome active ({bpm} BPM)",
        "metronome.beat_slot_title": "Beat {beat} — Click to cycle accent (Level {lvl})",
        "metronome.start": "Start metronome",
        "metronome.stop": "Stop metronome",
        "metronome.title": "Metronome",
        "practice.afk_alert": "Session automatically closed: extended inactivity detected. Your practice exercises have been saved to history.",
        "practice.break_prompt": "Take a break?",
        "practice.cancel_break": "Cancel break",
        "practice.exercise_fallback": "Exercise",
        "practice.finish_session": "End session",
        "practice.main_key": "Key of the day: {key}",
        "practice.session_finished": "Session ended",
        "practice.session_finished_saved": "Session finished and saved",
        "practice.session_of": "Session of {date}",
        "practice.timer_done_body": "Time's up: {name}",
        "routines.create_title": "New Routine",
        "routines.empty": "No saved routines.",
        "setlists.alert_enter_name": "Please enter a name for the setlist.",
        "setlists.empty": "No setlists found.",
        "setlists.live_btn": "Live",
        "setlists.new_title": "New Setlist",
        "setlists.no_tune_found": "No tunes found.",
        "setlists.saved_done": "Done",
        "setlists.search_prompt_empty": "Search for a tune above to add it.",
        "setlists.title": "My Setlists"
    }
};

function getCurrentLang() {
    try {
        const l = localStorage.getItem('piano_workout_lang');
        if (l === 'en' || l === 'fr') return l;
    } catch (_) { }
    return 'fr';
}

function getLocaleCode() {
    return getCurrentLang() === 'en' ? 'en-US' : 'fr-FR';
}

function t(key, params = {}) {
    const lang = getCurrentLang();
    const dict = I18N_DICT[lang] || I18N_DICT.fr;
    let val = dict[key] !== undefined ? dict[key] : (I18N_DICT.fr[key] !== undefined ? I18N_DICT.fr[key] : (I18N_DICT.en && I18N_DICT.en[key] !== undefined ? I18N_DICT.en[key] : key));
    if (typeof val !== 'string') return val;
    // Normalisation des paramètres aliases
    const p = { ...params };
    if (p.n !== undefined && p.count === undefined) p.count = p.n;
    if (p.count !== undefined && p.n === undefined) p.n = p.count;
    if (p.err !== undefined && p.error === undefined) p.error = p.err;
    if (p.error !== undefined && p.err === undefined) p.err = p.error;
    for (const [k, v] of Object.entries(p)) {
        val = val.replace(new RegExp(`\\{${k}\\}`, 'g'), v !== undefined && v !== null ? String(v) : '');
    }
    return val;
}

function getCategoriesDefautPourLangue(lang) {
    const l = lang || getCurrentLang();
    return JSON.parse(JSON.stringify(l === 'en' ? CATEGORIES_DEFAUT_EN : CATEGORIES_DEFAUT_FR));
}

function estCategoriesParDefautIntactes(catsObj) {
    if (!catsObj || typeof catsObj !== 'object') return true;
    const str = JSON.stringify(catsObj);
    return str === JSON.stringify(CATEGORIES_DEFAUT_FR) || str === JSON.stringify(CATEGORIES_DEFAUT_EN);
}

function estCategorieMorceaux(cat) {
    if (!cat) return false;
    const c = String(cat).trim();
    return c === 'Morceaux' || c === 'Tunes' || c === 'Songs';
}

function getNomCategorieMorceaux(catsObj) {
    const obj = catsObj || (typeof window !== 'undefined' && window.SOUS_CATEGORIES) || {};
    const keys = Object.keys(obj);
    const found = keys.find(k => estCategorieMorceaux(k));
    if (found) return found;
    return getCurrentLang() === 'en' ? 'Tunes' : 'Morceaux';
}

function estLabelFavoris(sc) {
    if (!sc) return false;
    const s = String(sc).trim();
    return s === 'Favoris' || s === 'Favorites';
}

// Helper interne : remplace uniquement le noeud texte d'un élément (préserve les icônes SVG enfants)
function setElementTextPreservingSvg(el, newText) {
    if (!el) return;
    const span = el.querySelector(':scope > span:not(.badge):not(.rec-icon-inner)');
    if (span && el.querySelector('svg')) {
        span.textContent = newText;
        return;
    }
    const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
    if (textNodes.length > 0) {
        textNodes[textNodes.length - 1].textContent = ' ' + newText;
    } else if (!el.querySelector('svg')) {
        el.textContent = newText;
    } else {
        el.appendChild(document.createTextNode(' ' + newText));
    }
}

function appliquerTraductionsDOM() {
    if (typeof document === 'undefined') return;
    const lang = getCurrentLang();
    if (document.documentElement) {
        document.documentElement.setAttribute('lang', lang);
    }

    // 1. Attributs déclaratifs data-i18n*
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) setElementTextPreservingSvg(el, t(key));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (key) el.setAttribute('title', t(key));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', t(key));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        if (key) el.innerHTML = t(key);
    });

    // 2. Ciblage direct des éléments statiques d'index.html
    const setTxt = (sel, key) => {
        const el = document.querySelector(sel);
        if (el) setElementTextPreservingSvg(el, t(key));
    };
    const setTitle = (sel, key) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute('title', t(key));
    };
    const setPh = (sel, key) => {
        const el = document.querySelector(sel);
        if (el) el.setAttribute('placeholder', t(key));
    };

    // Barre de navigation
    setTitle('#btn-nav-retour', 'nav.back_to_session');
    setTitle('#btn-nav-settings', 'nav.settings');
    setTxt('#btn-nav-historique', 'nav.history');
    setTxt('#btn-nav-biblio', 'nav.library');
    setTitle('#btn-nav-nouvelle', 'nav.new_session_title');
    setTxt('#btn-nav-nouvelle', 'nav.session');

    // Vue Pratique
    setTitle('#btn-pause-cafe', 'practice.break_title');
    setTitle('#btn-pause-global', 'practice.pause_resume_title');
    setTxt('#btn-terminer', 'practice.end_session');
    setTxt('#fin-seance-actions button.btn-ghost-green', 'practice.save');
    setTitle('#fin-seance-actions button.btn-ghost-red', 'practice.discard_stats_title');

    // Vue Création
    setTxt('#vue-creation .header-creation h2', 'creation.title');
    setTxt('#section-tonalite-creation h3', 'creation.key_section');
    setTitle('button[onclick="genererTonaliteAleatoire()"]', 'creation.random_key');
    const creationSections = document.querySelectorAll('#vue-creation .form-section');
    if (creationSections[1]) {
        const h3 = creationSections[1].querySelector('h3');
        if (h3) h3.textContent = t('creation.add_exercise_section');
    }
    if (creationSections[2]) {
        const h3 = creationSections[2].querySelector('h3');
        if (h3) h3.textContent = t('creation.session_section');
    }
    setTxt('button[onclick="toggleChampPrecis()"]', 'creation.details_btn');
    setPh('#input-contenu', 'creation.details_placeholder');
    setTitle('button[onclick="changerTemps(-5)"]', 'creation.sub_5_min');
    setTitle('#exo-time-swipe-zone', 'creation.swipe_time_title');
    setTxt('.exo-time-unit-label', 'creation.minutes_label');
    setTitle('button[onclick="changerTemps(5)"]', 'creation.add_5_min');
    if (typeof editDraftIndex !== 'undefined' && editDraftIndex !== null) {
        setTxt('#btn-add-draft', 'creation.update_exercise');
    } else {
        setTxt('#btn-add-draft', 'creation.add_to_session');
    }
    setTitle('#btn-import-routine', 'creation.import_routine_title');
    setTitle('#btn-save-routine', 'creation.save_routine_title');
    setTxt('#btn-save-seance', 'creation.save_session_btn');

    // Vue Bibliothèque
    setTxt('#vue-bibliotheque .header-creation h2', 'library.title');
    setTxt('button[onclick="reinitialiserBibliotheque()"]', 'library.reset');
    const biblioSections = document.querySelectorAll('#vue-bibliotheque .form-section');
    if (biblioSections[0]) {
        const h3 = biblioSections[0].querySelector('h3');
        if (h3) h3.textContent = t('library.add_section');
    }
    setTitle('#btn-inbox-zip-trigger', 'library.import_sort_title');
    setTxt('#btn-inbox-zip-trigger', 'library.import_sort_btn');
    setTitle('#btn-biblio-dictaphone', 'library.dictaphone_title');
    setTitle('#btn-biblio-cahier', 'library.notebook_title');

    const formVocab = document.getElementById('form-vocabulaire');
    if (formVocab) {
        const labels = formVocab.querySelectorAll('label');
        if (labels[0]) labels[0].textContent = t('library.item_name_label');
        if (labels[1]) labels[1].textContent = t('library.category_label');
        if (labels[2]) labels[2].textContent = t('library.subcategory_label');
        if (labels[3]) labels[3].textContent = t('library.score_label');
        if (labels[4]) labels[4].textContent = t('library.audio_label');
    }
    setPh('#input-vocab-nom', 'library.item_name_placeholder');
    const btnChooseImg = document.querySelector('div[onclick*="input-vocab-image"] > span:first-child');
    if (btnChooseImg) btnChooseImg.textContent = t('library.choose_files');
    const lblImg = document.getElementById('label-input-vocab-image');
    if (lblImg && (lblImg.textContent === 'Aucun fichier choisi' || lblImg.textContent === 'No file chosen')) {
        lblImg.textContent = t('library.no_file_chosen');
    }
    const btnChooseAud = document.querySelector('div[onclick*="input-vocab-audio"] > span:first-child');
    if (btnChooseAud) btnChooseAud.textContent = t('library.choose_file');
    const lblAud = document.getElementById('label-input-vocab-audio');
    if (lblAud && (lblAud.textContent === 'Aucun fichier choisi' || lblAud.textContent === 'No file chosen')) {
        lblAud.textContent = t('library.no_file_chosen');
    }
    if (typeof editVocabId === 'undefined' || editVocabId === null) {
        setTxt('#btn-submit-vocab', 'library.add_btn');
    } else {
        setTxt('#btn-submit-vocab', 'common.save');
    }
    setTxt('button[onclick="ouvrirGestionnairePlaylists()"]', 'library.setlists_btn');
    setPh('#search-biblio', 'library.search_placeholder');
    setTitle('#btn-filter-fav-biblio', 'library.fav_filter_title');
    setTxt('#label-filter-biblio', 'library.filter_btn');
    setTxt('#dd-biblio > button', 'library.sort_btn');
    setTxt('#sort-biblio-nom_asc', 'library.sort_az');
    setTxt('#sort-biblio-nom_desc', 'library.sort_za');
    setTxt('#sort-biblio-prat_desc', 'library.sort_most');
    setTxt('#sort-biblio-prat_asc', 'library.sort_least');

    // Vue Historique
    setTxt('#vue-historique .header-creation h2', 'history.title');
    setTxt('button[onclick="reinitialiserHistorique()"]', 'library.reset');
    const statCards = document.querySelectorAll('#vue-historique .stat-card');
    if (statCards[0]) {
        statCards[0].setAttribute('title', t('history.this_week_title'));
        const st = statCards[0].querySelector('.stat-title');
        if (st) st.textContent = t('history.this_week');
    }
    if (statCards[1]) {
        const st = statCards[1].querySelector('.stat-title');
        if (st) st.textContent = t('history.avg_completion');
    }
    if (statCards[2]) {
        const st = statCards[2].querySelector('.stat-title');
        if (st) st.textContent = t('history.current_streak');
    }
    if (statCards[3]) {
        statCards[3].setAttribute('title', t('history.top_key_title'));
        const st = statCards[3].querySelector('.stat-title');
        if (st) st.textContent = t('history.top_key');
    }
    setTxt('#vue-historique .form-section h3', 'history.recent_sessions');
    setTxt('#label-limite-historique', 'history.show_btn');
    setTxt('#limite-hist-10', 'history.last_10');
    setTxt('#limite-hist-20', 'history.last_20');
    setTxt('#limite-hist-50', 'history.last_50');
    setTxt('#limite-hist-toutes', 'history.all');

    // Modale Graphiques
    setTxt('#label-type-graph', 'graph.view_btn');
    setTxt('#filter-type-temps', 'graph.practice_time');
    setTxt('#filter-type-categories', 'graph.breakdown');
    setTxt('#label-periode-graph', 'graph.period_btn');
    setTxt('#filter-graph-semaine', 'graph.this_week');
    setTxt('#filter-graph-mois', 'graph.this_month');
    setTxt('#filter-graph-annee', 'graph.this_year');
    setTxt('#filter-graph-total', 'graph.all_time');

    // Modales Routines
    setTxt('#modal-routines h3', 'routines.my_routines');
    setTxt('#titre-modal-save-routine', 'routines.create_routine');
    const lblRoutine = document.querySelector('#modal-save-routine label');
    if (lblRoutine) lblRoutine.textContent = t('routines.routine_name_label');
    setPh('#input-routine-nom', 'routines.routine_name_placeholder');
    setTxt('#btn-valider-routine', 'routines.save_routine_btn');

    // Modale Partition & Annotations
    setTitle('#concert-hud-center', 'concert.open_setlist_title');
    setTitle('#btn-partition-audio', 'score.audio_btn_title');
    setTitle('#btn-partition-annotate', 'score.annotate_btn_title');
    setTitle('#btn-partition-close', 'score.close_btn_title');
    setTitle('#annotation-toolbar-drag-handle', 'score.move_toolbar');
    setTitle('#tool-pen', 'score.pen_title');
    setTitle('#tool-line', 'score.line_title');
    setTitle('#tool-text', 'score.text_title');
    setTitle('#tool-highlighter', 'score.highlighter_title');
    setTitle('#tool-eraser', 'score.eraser_title');
    const colorDots = document.querySelectorAll('#annotation-colors .color-dot');
    if (colorDots[0]) colorDots[0].setAttribute('title', t('score.color_black'));
    if (colorDots[1]) colorDots[1].setAttribute('title', t('score.color_red'));
    if (colorDots[2]) colorDots[2].setAttribute('title', t('score.color_blue'));
    setTitle('#btn-annotation-undo', 'score.undo_title');
    setTitle('#btn-cahier-add-system', 'cahier.add_system_title');
    setTitle('#btn-cahier-toggle-measures', 'cahier.toggle_barlines_title');
    setTitle('#btn-cahier-terminer', 'cahier.save_btn_title');
    setTitle('#btn-annotation-clear', 'score.clear_title');
    setTxt('#partition-loading span', 'score.loading');
    setTitle('#annotation-text-overlay', 'score.text_drag_title');
    setPh('#annotation-text-input', 'score.text_placeholder');
    setTitle('#annotation-text-resize-handle', 'score.text_resize_title');
    setTitle('#modal-concert-setlist button[onclick="quitterModeConcert()"]', 'concert.exit_title');

    // Modale Setlists
    setTxt('#titre-modal-playlist', 'setlists.my_setlists');
    setTxt('button[onclick="ouvrirEditeurPlaylist(null)"]', 'setlists.new_setlist');
    const plLabels = document.querySelectorAll('#vue-playlist-editeur > label');
    if (plLabels[0]) plLabels[0].textContent = t('setlists.name_label');
    if (plLabels[1]) plLabels[1].textContent = t('setlists.tunes_label');
    setPh('#input-playlist-nom', 'setlists.name_placeholder');
    setPh('#search-playlist-items', 'setlists.search_placeholder');
    setTxt('button[onclick="retourListePlaylists()"]', 'common.back');
    setTxt('#btn-save-playlist', 'common.save');

    // Modale Trieur Express
    setTxt('#modal-trieur .trieur-header h3', 'sorter.title');
    const curFileSpan = document.querySelector('#modal-trieur .trieur-body > div:first-child > span');
    if (curFileSpan) curFileSpan.textContent = t('sorter.current_file');
    const fusionHead = document.querySelector('#trieur-mode-fusion > div:first-child');
    if (fusionHead) fusionHead.textContent = t('sorter.matched_item');
    setTxt('#trieur-fusion-desc', 'sorter.merge_desc_score');
    setTxt('button[onclick="annulerFusionTrieur()"]', 'sorter.unlink_btn');
    const trieurLabels = document.querySelectorAll('#trieur-mode-creation > label');
    if (trieurLabels[0]) trieurLabels[0].textContent = t('sorter.item_title_label');
    if (trieurLabels[1]) trieurLabels[1].textContent = t('library.category_label');
    if (trieurLabels[2]) trieurLabels[2].textContent = t('library.subcategory_label');
    setPh('#trieur-input-titre', 'sorter.item_title_placeholder');
    setTxt('button[onclick="ignorerFichierTrieur()"]', 'sorter.skip_btn');
    setTxt('#btn-valider-trieur', 'sorter.save_next_btn');
    setTxt('#btn-valider-tout', 'sorter.apply_all_btn');

    // Modale Paramètres
    setTxt('#modal-settings h3', 'settings.title');
    setTxt('#tab-btn-categories', 'settings.tab_categories');
    setTxt('#tab-btn-pomodoro', 'settings.tab_pomodoro');
    setTxt('#tab-btn-audio', 'settings.tab_audio');
    setTxt('#tab-btn-theme', 'settings.tab_theme');
    setTxt('#tab-btn-backup', 'settings.tab_backup');

    const catPane = document.getElementById('settings-pane-categories');
    if (catPane) {
        const p = catPane.querySelector(':scope > p');
        if (p) p.textContent = t('settings.cat_intro');
        const lblNew = catPane.querySelector('label');
        if (lblNew) lblNew.textContent = t('settings.create_cat_label');
    }
    setPh('#input-new-category-name', 'settings.create_cat_placeholder');
    setTxt('button[onclick="ajouterNouvelleCategorie()"]', 'common.add');
    const lblKeyDay = document.querySelector('#settings-pane-categories div[style*="margin-top: 20px"] label');
    const spanKeyDay = document.querySelector('#settings-pane-categories div[style*="margin-top: 20px"] span');
    if (lblKeyDay) lblKeyDay.textContent = t('settings.key_of_day_label');
    if (spanKeyDay) spanKeyDay.textContent = t('settings.key_of_day_desc');
    setTxt('button[onclick="reinitialiserParametresDefaut()"]', 'settings.restore_defaults_btn');

    const pomoPane = document.getElementById('settings-pane-pomodoro');
    if (pomoPane) {
        const p = pomoPane.querySelector(':scope > p');
        if (p) p.textContent = t('settings.pomodoro_intro');
        const lbls = pomoPane.querySelectorAll('label');
        if (lbls[0]) lbls[0].textContent = t('settings.pomodoro_work_label');
        if (lbls[1]) lbls[1].textContent = t('settings.pomodoro_break_label');
    }

    const audioPane = document.getElementById('settings-pane-audio');
    if (audioPane) {
        const p = audioPane.querySelector(':scope > p');
        if (p) p.textContent = t('settings.audio_intro');
        const lbls = audioPane.querySelectorAll('label');
        if (lbls[0]) lbls[0].textContent = t('settings.audio_theme_label');
        if (lbls[1]) lbls[1].textContent = t('settings.master_volume_label');
        if (lbls[2]) lbls[2].textContent = t('settings.metro_sound_label');
    }
    setTxt('#select-settings-audio-theme option[value="jazz"]', 'settings.sound_jazz');
    setTxt('#select-settings-audio-theme option[value="arpege"]', 'settings.sound_classic');
    setTxt('#select-settings-audio-theme option[value="zen"]', 'settings.sound_zen');
    setTxt('#select-settings-audio-theme option[value="bip"]', 'settings.sound_beep');
    setTitle('button[onclick="testerSonNotification()"]', 'settings.test_sound_title');
    setTxt('#select-settings-metronome-theme option[value="bois"]', 'settings.metro_wood');
    setTxt('#select-settings-metronome-theme option[value="clic"]', 'settings.metro_click');
    setTxt('#select-settings-metronome-theme option[value="bip"]', 'settings.metro_beep');
    setTitle('button[onclick="testerSonMetronome()"]', 'settings.test_metro_title');

    setTxt('#settings-lang-desc', 'settings.language_intro');
    setTxt('#settings-theme-desc', 'settings.theme_intro');
    setTxt('#theme-card-oled strong', 'settings.theme_dark');
    setTxt('#theme-card-argile strong', 'settings.theme_argile');
    setTxt('#theme-card-groove strong', 'settings.theme_groove');
    setTxt('#theme-card-clair strong', 'settings.theme_light');

    const backupPane = document.getElementById('settings-pane-backup');
    if (backupPane) {
        const h4s = backupPane.querySelectorAll('h4');
        const ps = backupPane.querySelectorAll(':scope > div > p');
        if (h4s[0]) setElementTextPreservingSvg(h4s[0], t('settings.export_heading'));
        if (ps[0]) ps[0].textContent = t('settings.export_intro');
        if (h4s[1]) setElementTextPreservingSvg(h4s[1], t('settings.restore_heading'));
        if (ps[1]) ps[1].textContent = t('settings.restore_intro');
    }
    setTxt('#btn-export-zip strong', 'settings.export_zip_title');
    setTxt('#btn-export-zip span', 'settings.export_zip_desc');
    setTxt('#btn-export-json strong', 'settings.export_json_title');
    setTxt('#btn-export-json span', 'settings.export_json_desc');
    setTxt('#btn-import-backup span', 'settings.select_backup_btn');
    const androidGuide = document.querySelector('#settings-pane-backup > div:last-child div[style*="line-height: 1.5"]');
    if (androidGuide) {
        androidGuide.innerHTML = `<strong style="color: var(--text-primary); display: block; margin-bottom: 2px;">${t('settings.android_update_title')}</strong>${t('settings.android_update_body')}`;
    }

    // Modale Métronome
    setTxt('#modal-metronome h3', 'metro.title');
    setTitle('#modal-metronome .close-modal', 'metro.close_title');
    setTitle('#metro-bpm-container', 'metro.drag_tempo_title');
    const metroLabel = document.querySelector('#modal-metronome label');
    if (metroLabel) metroLabel.textContent = t('metro.meter_label');
    setTitle('#btn-metro-unit-4', 'metro.quarter_title');
    setTitle('#btn-metro-unit-8', 'metro.eighth_title');
    setTitle('#btn-metro-toggle', 'metro.toggle_title');

    // Modale Lecteur Audio
    setTxt('#transcribe-player-title', 'audio.title');
    setTitle('#modal-audio-player .close-modal', 'audio.close_title');
    setTitle('button[onclick="sauterAudioSecondes(-5)"]', 'audio.rewind_title');
    setTitle('#transcribe-btn-play-pause', 'audio.play_pause_title');
    setTitle('button[onclick="sauterAudioSecondes(5)"]', 'audio.forward_title');
    const audioBoxTitles = document.querySelectorAll('#modal-audio-player div[style*="text-transform: uppercase"]');
    if (audioBoxTitles[0]) audioBoxTitles[0].textContent = t('audio.loop_section');
    if (audioBoxTitles[1]) audioBoxTitles[1].textContent = t('audio.speed_section');
    setTitle('#transcribe-btn-loop-toggle', 'audio.loop_toggle_title');
    setTxt('#transcribe-btn-set-a', 'audio.set_a');
    setTxt('#transcribe-btn-set-b', 'audio.set_b');
    setTitle('button[onclick="reinitialiserBoucleAB()"]', 'audio.clear_ab_title');
    setTitle('#transcribe-btn-mute', 'audio.mute_title');

    // Modale Dictaphone
    setTxt('#modal-dictaphone h3', 'dictaphone.title');
    setTitle('#modal-dictaphone .close-modal', 'common.close');
    if (typeof dictaphoneState === 'undefined' || !dictaphoneState.isRecording) {
        setTxt('#dictaphone-rec-status', 'dictaphone.ready');
    }
    setTitle('#dictaphone-btn-cancel', 'dictaphone.cancel_title');
    setTitle('#dictaphone-btn-toggle-rec', 'dictaphone.start_title');
    setTitle('#dictaphone-btn-pause', 'dictaphone.pause_title');
    const reviewSpan = document.querySelector('#dictaphone-vue-resultat > div:first-child span:first-child');
    if (reviewSpan) reviewSpan.textContent = t('dictaphone.review_take');
    const saveBiblioHead = document.querySelector('#dictaphone-bloc-biblio > div:first-child');
    if (saveBiblioHead) saveBiblioHead.textContent = t('dictaphone.save_to_library');
    const lblDictTitre = document.querySelector('#dictaphone-bloc-biblio label');
    if (lblDictTitre) lblDictTitre.textContent = t('dictaphone.take_title_label');
    setPh('#dictaphone-input-titre', 'dictaphone.take_title_placeholder');
    setTxt('#dictaphone-btn-ajouter-item', 'common.add');
    setTxt('button[onclick="recommencerPriseDictaphone()"]', 'dictaphone.retake');
    setTitle('button[onclick="telechargerFichierDictaphone()"]', 'dictaphone.export_title');
    setTxt('button[onclick="telechargerFichierDictaphone()"]', 'dictaphone.export');
    setTxt('#dictaphone-vue-resultat button[onclick="fermerModalDictaphone()"]', 'common.close');

    // Modales Cahier
    setTxt('#modal-cahier-choix h3', 'cahier.title');
    setTxt('button[onclick="demarrerCahier(\'simple\')"] span', 'cahier.single_staff');
    setTxt('button[onclick="demarrerCahier(\'double\')"] span', 'cahier.grand_staff');
    setTxt('#modal-cahier-save h3', 'cahier.title');
    const cahierSaveHead = document.querySelector('#cahier-bloc-biblio > div:first-child');
    if (cahierSaveHead) cahierSaveHead.textContent = t('cahier.save_to_library');
    const cahierSaveLbl = document.querySelector('#cahier-bloc-biblio label');
    if (cahierSaveLbl) cahierSaveLbl.textContent = t('cahier.title_label');
    setTxt('#cahier-btn-ajouter-item', 'common.add');
    setTitle('button[onclick="fermerModalCahierSave()"]', 'cahier.keep_editing_title');
    setTxt('button[onclick="fermerModalCahierSave()"]', 'cahier.keep_editing');
    setTitle('#cahier-btn-exporter', 'cahier.export_pdf_title');
    setTxt('#cahier-btn-exporter', 'cahier.export_btn');
    setTxt('button[onclick="quitterCahierSansSauvegarder()"]', 'common.close');

    // Mise à jour de l'indicateur visuel de langue dans les Paramètres
    majLangueUI(lang);
}

function majLangueUI(lang) {
    if (typeof document === 'undefined') return;
    const l = lang || getCurrentLang();
    ['fr', 'en'].forEach(code => {
        const card = document.getElementById(`lang-card-${code}`);
        if (card) card.classList.toggle('active', code === l);
        const pill = document.getElementById(`settings-lang-pill-${code}`);
        if (pill) {
            pill.classList.toggle('active', code === l);
            pill.classList.toggle('btn-ghost-blue', code === l);
            pill.classList.toggle('btn-ghost-neutral', code !== l);
        }
    });
}

function changerLangue(nouvelleLangue, fermerModalePremierLancement = false) {
    const lang = (nouvelleLangue === 'en') ? 'en' : 'fr';
    try {
        localStorage.setItem('piano_workout_lang', lang);
    } catch (_) { }

    // Si les catégories actuelles sont encore celles par défaut (non modifiées par l'utilisateur),
    // on bascule automatiquement les catégories par défaut dans la langue choisie !
    if (typeof SOUS_CATEGORIES !== 'undefined' && estCategoriesParDefautIntactes(SOUS_CATEGORIES)) {
        const defCats = getCategoriesDefautPourLangue(lang);
        if (typeof sauvegarderCategoriesConfig === 'function') {
            sauvegarderCategoriesConfig(defCats);
        }
    }

    appliquerTraductionsDOM();

    // Rafraîchir les composants dynamiques
    try { if (typeof initCreationUI === 'function') initCreationUI(); } catch (_) { }
    try { if (typeof initBibliothequeUI === 'function') initBibliothequeUI(); } catch (_) { }
    try { if (typeof renderBibliotheque === 'function') renderBibliotheque(); } catch (_) { }
    try { if (typeof afficherBrouillon === 'function') afficherBrouillon(); } catch (_) { }
    try { if (typeof renderSettingsCategoriesUI === 'function') renderSettingsCategoriesUI(); } catch (_) { }
    try { if (typeof majAffichageTonaliteCreationUI === 'function') majAffichageTonaliteCreationUI(); } catch (_) { }
    try { if (typeof majUIMetronome === 'function') majUIMetronome(); } catch (_) { }
    try { if (typeof majAffichagePalmRejectionUI === 'function') majAffichagePalmRejectionUI(); } catch (_) { }
    try { if (typeof chargerHistorique === 'function') chargerHistorique(); } catch (_) { }
    try {
        if (typeof seanceEnCours !== 'undefined' && seanceEnCours && seanceEnCours.statut === 'en_cours') {
            if (typeof afficherSeancePratique === 'function') afficherSeancePratique();
        }
    } catch (_) { }

    if (fermerModalePremierLancement) {
        const modalFirst = document.getElementById('modal-first-lang');
        if (modalFirst) modalFirst.style.display = 'none';
    }
}

function verifierPremierLancementLangue() {
    try {
        const dejaChoisi = localStorage.getItem('piano_workout_lang');
        if (!dejaChoisi) {
            const modalFirst = document.getElementById('modal-first-lang');
            if (modalFirst) modalFirst.style.display = 'flex';
        }
    } catch (_) { }
}

if (typeof window !== 'undefined') {
    window.I18N_DICT = I18N_DICT;
    window.CATEGORIES_DEFAUT_FR = CATEGORIES_DEFAUT_FR;
    window.CATEGORIES_DEFAUT_EN = CATEGORIES_DEFAUT_EN;
    window.getCurrentLang = getCurrentLang;
    window.getLocaleCode = getLocaleCode;
    window.t = t;
    window.getCategoriesDefautPourLangue = getCategoriesDefautPourLangue;
    window.estCategoriesParDefautIntactes = estCategoriesParDefautIntactes;
    window.estCategorieMorceaux = estCategorieMorceaux;
    window.getNomCategorieMorceaux = getNomCategorieMorceaux;
    window.estLabelFavoris = estLabelFavoris;
    window.appliquerTraductionsDOM = appliquerTraductionsDOM;
    window.changerLangue = changerLangue;
    window.verifierPremierLancementLangue = verifierPremierLancementLangue;
}
