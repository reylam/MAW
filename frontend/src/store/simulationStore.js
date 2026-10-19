import { create } from 'zustand';

export const useSimulationStore = create((set) => ({
  isSimulationMode: false,
  activeScenario: null,
  scenarioStage: 0,
  isTrainApproaching: false,
  crossingStatuses: {},

  toggleSimulationMode: () => set((state) => ({ isSimulationMode: !state.isSimulationMode })),
  
  startScenario: (scenario) => set({
    isSimulationMode: true,
    activeScenario: scenario,
    scenarioStage: 0,
    isTrainApproaching: scenario === 'train-approaching',
  }),

  nextStage: () => set((state) => ({ scenarioStage: state.scenarioStage + 1 })),
  
  setCrossingStatus: (crossingId, status) => set((state) => ({
    crossingStatuses: { ...state.crossingStatuses, [crossingId]: status }
  })),

  resetSimulation: () => set({
    isSimulationMode: false,
    activeScenario: null,
    scenarioStage: 0,
    isTrainApproaching: false,
    crossingStatuses: {},
  }),
}));
