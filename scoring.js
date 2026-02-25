/**
 * Racketlon Scoring Calculator
 *
 * Rules:
 * - 4 sports: Table Tennis → Badminton → Squash → Tennis
 * - Each set to 21 points (win by 2, but for total calculation we use actual scores)
 * - Winner = most total points across all sports
 * - Match ends when leader has more points than remain to play
 * - Gummiarm: if tied after 4 sports, 1 decisive point in tennis
 */

const SPORTS = ["tabletennis", "badminton", "squash", "tennis"];
const SPORT_LABELS = {
  tabletennis: "Ping-pong",
  badminton: "Badminton",
  squash: "Squash",
  tennis: "Tennis",
};
const MAX_POINTS_PER_SET = 21;

/**
 * Parse a score string like "21-15" or "21 - 15" into [playerA, playerB]
 */
function parseScore(scoreStr) {
  if (!scoreStr || scoreStr.trim() === "" || scoreStr === "-") {
    return null;
  }
  const cleaned = scoreStr.replace(/\s+/g, "");
  const match = cleaned.match(/^(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

/**
 * Calculate totals and analysis from scores
 * @param {Object} scores - { tabletennis: "21-15", badminton: "18-21", ... }
 * @param {string} playerA - Name of player A
 * @param {string} playerB - Name of player B
 */
function analyzeMatch(scores, playerA = "Joueur A", playerB = "Joueur B") {
  const result = {
    playerA,
    playerB,
    sports: {},
    totalA: 0,
    totalB: 0,
    currentDelta: 0, // positive = A leads
    sportsPlayed: 0,
    sportsRemaining: 0,
    maxRemainingPoints: 0,
    status: "in_progress", // 'in_progress', 'finished', 'gummiarm'
    winner: null,
    analysis: [],
  };

  // Parse each sport
  for (const sport of SPORTS) {
    const parsed = parseScore(scores[sport]);
    result.sports[sport] = {
      label: SPORT_LABELS[sport],
      played: parsed !== null,
      scoreA: parsed ? parsed[0] : null,
      scoreB: parsed ? parsed[1] : null,
      delta: parsed ? parsed[0] - parsed[1] : 0,
    };

    if (parsed) {
      result.totalA += parsed[0];
      result.totalB += parsed[1];
      result.sportsPlayed++;
    }
  }

  result.sportsRemaining = 4 - result.sportsPlayed;
  result.currentDelta = result.totalA - result.totalB;
  result.maxRemainingPoints = result.sportsRemaining * MAX_POINTS_PER_SET;

  // Determine status
  if (result.sportsPlayed === 4) {
    if (result.currentDelta === 0) {
      result.status = "gummiarm";
      result.analysis.push({
        type: "gummiarm",
        message: `Égalité parfaite ${result.totalA}-${result.totalB} ! Direction le Gummiarm 🎾`,
      });
    } else {
      result.status = "finished";
      result.winner = result.currentDelta > 0 ? playerA : playerB;
      const winnerTotal = Math.max(result.totalA, result.totalB);
      const loserTotal = Math.min(result.totalA, result.totalB);
      result.analysis.push({
        type: "winner",
        message: `${result.winner} gagne ${winnerTotal}-${loserTotal} (+${Math.abs(result.currentDelta)} pts)`,
      });
    }
  } else if (Math.abs(result.currentDelta) > result.maxRemainingPoints) {
    // Match already decided
    result.status = "finished";
    result.winner = result.currentDelta > 0 ? playerA : playerB;
    result.analysis.push({
      type: "winner",
      message: `${result.winner} a déjà gagné ! Avance de ${Math.abs(result.currentDelta)} pts, seulement ${result.maxRemainingPoints} pts restants possibles.`,
    });
  } else {
    result.status = "in_progress";
    generateInProgressAnalysis(result, playerA, playerB, scores);
  }

  return result;
}

/**
 * Generate detailed analysis for in-progress match
 */
function generateInProgressAnalysis(result, playerA, playerB, scores) {
  const { currentDelta, sportsRemaining, maxRemainingPoints } = result;

  // Current leader
  if (currentDelta > 0) {
    result.analysis.push({
      type: "leader",
      message: `${playerA} mène de ${currentDelta} points (${result.totalA}-${result.totalB})`,
    });
  } else if (currentDelta < 0) {
    result.analysis.push({
      type: "leader",
      message: `${playerB} mène de ${Math.abs(currentDelta)} points (${result.totalB}-${result.totalA})`,
    });
  } else {
    result.analysis.push({
      type: "tied",
      message: `Égalité parfaite ${result.totalA}-${result.totalB}`,
    });
  }

  // Find next sport to play
  const nextSportIndex = SPORTS.findIndex((s) => !result.sports[s].played);
  const nextSport = nextSportIndex >= 0 ? SPORTS[nextSportIndex] : null;

  if (!nextSport) {
    return;
  }

  // Calculate points needed for each player to win
  // After current sport, remaining points from subsequent sports
  const pointsAfterNext = (sportsRemaining - 1) * MAX_POINTS_PER_SET;

  // For player A to clinch (make it impossible for B to catch up)
  // A needs: currentDelta + (gainInNextSport) > pointsAfterNext
  // So: gainInNextSport > pointsAfterNext - currentDelta
  // If A wins 21-0 in next sport, gain = 21
  // If A wins 21-X, gain = 21-2X (since B gets X)

  // Points needed to WIN the match outright after this sport
  const pointsNeededAToWin = Math.max(0, pointsAfterNext - currentDelta + 1);
  const pointsNeededBToWin = Math.max(0, pointsAfterNext + currentDelta + 1);

  // Analysis for next sport
  const nextLabel = SPORT_LABELS[nextSport];

  // Scenario calculations for the next sport
  if (sportsRemaining === 1) {
    // Last sport (tennis)
    analyzeLastSport(result, playerA, playerB, currentDelta, nextLabel);
  } else if (sportsRemaining === 2) {
    // Squash remaining, then tennis
    analyzeBeforeTennis(result, playerA, playerB, currentDelta, nextLabel, scores);
  } else {
    // 2+ sports remaining
    analyzeMultipleSportsRemaining(
      result,
      playerA,
      playerB,
      currentDelta,
      nextLabel,
      sportsRemaining,
    );
  }
}

/**
 * Analysis when only tennis remains
 */
function analyzeLastSport(result, playerA, playerB, delta, sportLabel) {
  if (delta > 0) {
    // A leads - B needs to catch up
    if (delta > 21) {
      result.analysis.push({
        type: "clinched",
        message: `${playerA} a déjà gagné ! Même un 0-21 au ${sportLabel} ne suffirait pas.`,
      });
    } else if (delta === 21) {
      result.analysis.push({
        type: "scenario",
        message: `${playerB} doit faire 21-0 au ${sportLabel} pour aller au Gummiarm`,
      });
    } else {
      // B needs to win by delta+1 to win
      const bMinWinScore = 21 - delta - 1; // max A can have for B to win
      const gummiScore = 21 - delta;

      result.analysis.push({
        type: "scenario",
        message: `🏆 ${playerB} gagne si ${sportLabel} ≥ 21-${bMinWinScore}`,
      });
      result.analysis.push({
        type: "scenario",
        message: `🏆 ${playerA} gagne si ${sportLabel} ≤ 21-${bMinWinScore + 2} ou ${playerA} gagne le set`,
      });
      if (delta <= 21) {
        result.analysis.push({
          type: "gummiarm_scenario",
          message: `⚡ Gummiarm si ${sportLabel} = 21-${gummiScore}`,
        });
      }
    }
  } else if (delta < 0) {
    // B leads - A needs to catch up
    const absDelta = Math.abs(delta);
    if (absDelta > 21) {
      result.analysis.push({
        type: "clinched",
        message: `${playerB} a déjà gagné ! Même un 21-0 au ${sportLabel} ne suffirait pas.`,
      });
    } else {
      // A needs to win by absDelta+1 to win
      const aMinWinScore = 21 - absDelta - 1; // max B can have for A to win
      const gummiScore = 21 - absDelta;

      result.analysis.push({
        type: "scenario",
        message: `🏆 ${playerA} gagne si ${sportLabel} ≥ 21-${aMinWinScore}`,
      });
      result.analysis.push({
        type: "scenario",
        message: `🏆 ${playerB} gagne si ${sportLabel} ≤ 21-${aMinWinScore + 2} ou ${playerB} gagne le set`,
      });
      if (absDelta <= 21) {
        result.analysis.push({
          type: "gummiarm_scenario",
          message: `⚡ Gummiarm si ${sportLabel} = 21-${gummiScore}`,
        });
      }
    }
  } else {
    // Tied going into tennis
    result.analysis.push({
      type: "scenario",
      message: `Le gagnant du ${sportLabel} remporte le match !`,
    });
    result.analysis.push({
      type: "gummiarm_scenario",
      message: `⚡ Gummiarm si égalité au ${sportLabel}`,
    });
  }
}

/**
 * Analysis before tennis (squash remaining)
 * Key question: can we avoid/force tennis?
 */
function analyzeBeforeTennis(result, playerA, playerB, delta, sportLabel, scores) {
  result.analysis.push({
    type: "header",
    message: `📊 Analyse ${sportLabel} :`,
  });

  // Points to clinch WITHOUT needing tennis
  // To win without tennis: |delta + squashGain| > 21 (max tennis points)
  // So squashGain > 21 - delta (for A) or squashGain < -(21 + delta) (for B to win means A loses)

  const maxSquashGain = 21; // Best case: 21-0
  const minSquashGain = -21; // Worst case: 0-21

  // For A to win WITHOUT tennis (clinch after squash):
  // currentDelta + squashGain > 21
  // squashGain > 21 - currentDelta
  const aGainNeededToSkipTennis = 22 - delta; // Need to be ahead by MORE than 21

  // For B to win WITHOUT tennis:
  // currentDelta + squashGain < -21
  // squashGain < -21 - currentDelta
  const bGainNeededToSkipTennis = -22 - delta; // squashGain must be less than this

  if (delta >= 0) {
    // A leads or tied
    if (aGainNeededToSkipTennis <= 21) {
      // A can potentially clinch at squash
      const aScoreNeeded = calculateScoreForGain(aGainNeededToSkipTennis);
      if (aScoreNeeded) {
        result.analysis.push({
          type: "skip_tennis",
          message: `🏆 ${playerA} gagne SANS tennis si : ${sportLabel} en ${aScoreNeeded} ou mieux`,
        });
      }
    }

    if (delta <= 21) {
      // B can still potentially clinch
      const bGainNeeded = Math.abs(bGainNeededToSkipTennis);
      if (bGainNeeded <= 21) {
        const bScoreNeeded = calculateScoreForGain(bGainNeeded, true);
        if (bScoreNeeded) {
          result.analysis.push({
            type: "skip_tennis",
            message: `🏆 ${playerB} gagne SANS tennis si : ${sportLabel} en ${bScoreNeeded} ou mieux`,
          });
        }
      }
    }

    // What does each player need to be "safe" going into tennis?
    // Going into tennis with a lead makes life easier
    const aNeededForLead = delta <= 0 ? Math.abs(delta) + 1 : 0;
    const bNeededForLead = delta >= 0 ? delta + 1 : 0;

    if (delta > 0) {
      result.analysis.push({
        type: "tennis_setup",
        message: `🎾 ${playerA} va au tennis avec l'avantage si perd de ${delta - 1} pts ou moins au ${sportLabel}`,
      });
      result.analysis.push({
        type: "tennis_setup",
        message: `🎾 ${playerB} doit gagner +${delta + 1} pts au ${sportLabel} pour avoir l'avantage au tennis`,
      });
    } else if (delta === 0) {
      result.analysis.push({
        type: "tennis_setup",
        message: `🎾 Le gagnant du ${sportLabel} aura l'avantage au tennis`,
      });
    }
  } else {
    // B leads
    const absDelta = Math.abs(delta);

    // B can clinch?
    const bGainForClinch = 22 - absDelta;
    if (bGainForClinch <= 21) {
      const bScoreNeeded = calculateScoreForGain(bGainForClinch, true);
      if (bScoreNeeded) {
        result.analysis.push({
          type: "skip_tennis",
          message: `🏆 ${playerB} gagne SANS tennis si : ${sportLabel} en ${bScoreNeeded} ou mieux`,
        });
      }
    }

    // A can clinch?
    const aGainForClinch = 22 + absDelta;
    if (aGainForClinch <= 21) {
      const aScoreNeeded = calculateScoreForGain(aGainForClinch);
      if (aScoreNeeded) {
        result.analysis.push({
          type: "skip_tennis",
          message: `🏆 ${playerA} gagne SANS tennis si : ${sportLabel} en ${aScoreNeeded} ou mieux`,
        });
      }
    }

    result.analysis.push({
      type: "tennis_setup",
      message: `🎾 ${playerB} va au tennis avec l'avantage si perd de ${absDelta - 1} pts ou moins au ${sportLabel}`,
    });
    result.analysis.push({
      type: "tennis_setup",
      message: `🎾 ${playerA} doit gagner +${absDelta + 1} pts au ${sportLabel} pour avoir l'avantage au tennis`,
    });
  }
}

/**
 * Calculate example score for a given point gain
 * @param {number} gain - Points to gain (positive)
 * @param {boolean} forB - If true, format as B winning (e.g., "15-21")
 */
function calculateScoreForGain(gain, forB = false) {
  if (gain > 21 || gain < -21) {
    return null;
  }

  // Best case: win 21 - X where gain = 21 - 2X + X = 21 - X
  // So X = 21 - gain
  const loserScore = Math.max(0, 21 - gain);

  if (loserScore > 21) {
    return null;
  }

  if (forB) {
    return `${loserScore}-21`;
  }
  return `21-${loserScore}`;
}

/**
 * Analysis when 2+ sports remaining after next
 */
function analyzeMultipleSportsRemaining(result, playerA, playerB, delta, sportLabel, remaining) {
  const pointsAfterThis = (remaining - 1) * MAX_POINTS_PER_SET;

  result.analysis.push({
    type: "info",
    message: `${remaining} sports restants (${pointsAfterThis + 21} pts max)`,
  });

  // Can anyone clinch after this sport?
  // Need: |delta + gain| > pointsAfterThis
  const aGainToClinch = pointsAfterThis - delta + 1;
  const bGainToClinch = pointsAfterThis + delta + 1;

  if (aGainToClinch <= 21) {
    const score = calculateScoreForGain(aGainToClinch);
    result.analysis.push({
      type: "clinch_possible",
      message: `${playerA} peut gagner après ${sportLabel} avec un ${score} ou mieux`,
    });
  }

  if (bGainToClinch <= 21) {
    const score = calculateScoreForGain(bGainToClinch, true);
    result.analysis.push({
      type: "clinch_possible",
      message: `${playerB} peut gagner après ${sportLabel} avec un ${score} ou mieux`,
    });
  }

  if (aGainToClinch > 21 && bGainToClinch > 21) {
    result.analysis.push({
      type: "info",
      message: `Aucun ne peut gagner après ${sportLabel} seul, le match continue`,
    });
  }
}

// Export for use in app
if (typeof module !== "undefined" && module.exports) {
  module.exports = { analyzeMatch, parseScore, SPORTS, SPORT_LABELS };
}
