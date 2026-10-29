// Module 4 : Navigation du Lecteur de Partition & Double-Buffering PDF (score-navigation)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ScoreNavigation = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const DRAWING_TOOLS = new Set(['pen', 'line', 'highlighter', 'eraser', 'text']);

    function getPrerenderTargets(currentIndex, totalCount, type) {
        const count = Math.max(0, Number(totalCount) || 0);
        const curr = Math.max(0, Math.min(count > 0 ? count - 1 : 0, Number(currentIndex) || 0));

        if (type === 'cahier' || type === 'none' || count <= 1) {
            return {
                prev: null,
                current: curr,
                next: null
            };
        }

        return {
            prev: curr > 0 ? curr - 1 : null,
            current: curr,
            next: curr < count - 1 ? curr + 1 : null
        };
    }

    function getAnnotationKey(sourceNom, titre, pageIndex) {
        const src = sourceNom || titre || 'partition';
        const cleanSrc = String(src).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        const idx = Math.max(0, Number(pageIndex) || 0);
        return `annot_${cleanSrc}_p${idx}`;
    }

    function isSwipeAllowed(context) {
        if (!context || typeof context !== 'object') return true;
        if (context.type === 'cahier') return false;
        if (context.type === 'none' && !context.isLiveMode) return false;
        if (context.isAnnotationActive) {
            const tool = context.activeTool || 'pen';
            if (DRAWING_TOOLS.has(tool)) {
                return false;
            }
        }
        return true;
    }

    function createNavigationMachine(initialState) {
        const init = initialState || {};
        let state = {
            type: init.type || 'none',
            sourceNom: init.sourceNom || '',
            titre: init.titre || '',
            itemId: init.itemId !== undefined ? init.itemId : null,
            totalCount: Math.max(0, Number(init.totalCount) || 0),
            currentIndex: Math.max(0, Number(init.currentIndex) || 0),
            isLiveMode: !!init.isLiveMode,
            setlistSongs: Array.isArray(init.setlistSongs) ? init.setlistSongs.slice() : [],
            currentSongIndex: Math.max(0, Number(init.currentSongIndex) || 0),
            isAnnotationActive: !!init.isAnnotationActive,
            activeTool: init.activeTool || 'pen'
        };

        function loadDocument(docInfo) {
            if (!docInfo || typeof docInfo !== 'object') return getState();
            if (docInfo.type !== undefined) state.type = docInfo.type;
            if (docInfo.sourceNom !== undefined) state.sourceNom = docInfo.sourceNom;
            if (docInfo.titre !== undefined) state.titre = docInfo.titre;
            if (docInfo.itemId !== undefined) state.itemId = docInfo.itemId;
            if (docInfo.totalCount !== undefined) state.totalCount = Math.max(0, Number(docInfo.totalCount) || 0);
            if (docInfo.currentIndex === 'last') {
                state.currentIndex = state.totalCount > 1 ? state.totalCount - 1 : 0;
            } else if (docInfo.currentIndex !== undefined) {
                const maxIdx = state.totalCount > 0 ? state.totalCount - 1 : 0;
                state.currentIndex = Math.max(0, Math.min(maxIdx, Number(docInfo.currentIndex) || 0));
            }
            if (docInfo.isLiveMode !== undefined) state.isLiveMode = !!docInfo.isLiveMode;
            if (Array.isArray(docInfo.setlistSongs)) state.setlistSongs = docInfo.setlistSongs.slice();
            if (docInfo.currentSongIndex !== undefined) state.currentSongIndex = Math.max(0, Number(docInfo.currentSongIndex) || 0);
            if (docInfo.isAnnotationActive !== undefined) state.isAnnotationActive = !!docInfo.isAnnotationActive;
            if (docInfo.activeTool !== undefined) state.activeTool = docInfo.activeTool;
            return getState();
        }

        function setAnnotationMode(isActive, activeTool) {
            state.isAnnotationActive = !!isActive;
            if (activeTool !== undefined) {
                state.activeTool = activeTool;
            }
            return getState();
        }

        function canTurnPage(delta) {
            if (state.type === 'cahier' || !delta) return false;
            const isLastPage = (state.totalCount <= 1) || (state.currentIndex >= state.totalCount - 1);
            const isFirstPage = (state.currentIndex <= 0);

            if (state.isLiveMode) {
                if (delta > 0 && isLastPage) {
                    return state.currentSongIndex < state.setlistSongs.length - 1;
                }
                if (delta < 0 && isFirstPage) {
                    return state.currentSongIndex > 0;
                }
                return true;
            }

            if (delta > 0) {
                return state.totalCount > 1 && state.currentIndex < state.totalCount - 1;
            }
            if (delta < 0) {
                return state.totalCount > 1 && state.currentIndex > 0;
            }
            return false;
        }

        function getState() {
            const prerenderTargets = getPrerenderTargets(state.currentIndex, state.totalCount, state.type);
            const annotationKey = getAnnotationKey(state.sourceNom, state.titre, state.currentIndex);
            const swipeAllowed = isSwipeAllowed(state);
            return {
                ...state,
                prerenderTargets,
                annotationKey,
                canTurnPrev: canTurnPage(-1),
                canTurnNext: canTurnPage(1),
                isSwipeLocked: !swipeAllowed
            };
        }

        function turnPage(delta) {
            const step = delta > 0 ? 1 : (delta < 0 ? -1 : 0);
            if (state.type === 'cahier' || !step) {
                return { action: 'noop', reason: 'locked' };
            }

            const isLastPage = (state.totalCount <= 1) || (state.currentIndex >= state.totalCount - 1);
            const isFirstPage = (state.currentIndex <= 0);

            if (state.isLiveMode) {
                if (step > 0 && isLastPage) {
                    if (state.currentSongIndex < state.setlistSongs.length - 1) {
                        const previousSongIndex = state.currentSongIndex;
                        state.currentSongIndex += 1;
                        return {
                            action: 'song',
                            previousSongIndex,
                            songIndex: state.currentSongIndex,
                            song: state.setlistSongs[state.currentSongIndex] || null,
                            targetPage: 0
                        };
                    }
                    return { action: 'noop', reason: 'end_of_setlist' };
                }

                if (step < 0 && isFirstPage) {
                    if (state.currentSongIndex > 0) {
                        const previousSongIndex = state.currentSongIndex;
                        state.currentSongIndex -= 1;
                        return {
                            action: 'song',
                            previousSongIndex,
                            songIndex: state.currentSongIndex,
                            song: state.setlistSongs[state.currentSongIndex] || null,
                            targetPage: 'last'
                        };
                    }
                    return { action: 'noop', reason: 'start_of_setlist' };
                }
            }

            if (!canTurnPage(step)) {
                return { action: 'noop', reason: 'boundary' };
            }

            const previousPageIndex = state.currentIndex;
            state.currentIndex = state.currentIndex + step;
            return {
                action: 'page',
                previousPageIndex,
                pageIndex: state.currentIndex,
                prerenderTargets: getPrerenderTargets(state.currentIndex, state.totalCount, state.type),
                annotationKey: getAnnotationKey(state.sourceNom, state.titre, state.currentIndex)
            };
        }

        function evaluateSwipe(gesture) {
            const g = gesture || {};
            if (!isSwipeAllowed(state)) {
                return {
                    allowed: false,
                    isHorizontalSwipe: false,
                    dragOffsetPx: 0,
                    shouldTurn: false,
                    delta: 0
                };
            }

            const dx = Number(g.dx) || 0;
            const dy = Number(g.dy) || 0;
            const elapsedMs = Math.max(1, Number(g.elapsedMs) || 1);
            const containerWidth = Math.max(100, Number(g.containerWidth) || 800);
            const alreadySwiping = !!g.alreadySwiping;

            const isHorizontalSwipe = alreadySwiping || (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15);
            if (!isHorizontalSwipe || dx === 0) {
                return {
                    allowed: true,
                    isHorizontalSwipe: false,
                    dragOffsetPx: 0,
                    shouldTurn: false,
                    delta: 0
                };
            }

            const delta = dx < 0 ? 1 : -1;
            const canTurn = canTurnPage(delta);
            const dragOffsetPx = canTurn ? dx : dx * 0.22;

            const velocityX = Math.abs(dx) / elapsedMs;
            const swipeThreshold = Math.min(90, containerWidth * 0.16);
            const shouldTurn = canTurn && (Math.abs(dx) > swipeThreshold || (Math.abs(dx) > 28 && velocityX > 0.45));

            return {
                allowed: true,
                isHorizontalSwipe: true,
                dragOffsetPx,
                shouldTurn,
                delta
            };
        }

        return {
            getState,
            loadDocument,
            setAnnotationMode,
            canTurnPage,
            turnPage,
            evaluateSwipe
        };
    }

    return {
        name: 'score-navigation',
        getPrerenderTargets,
        getAnnotationKey,
        isSwipeAllowed,
        createNavigationMachine
    };
}));
