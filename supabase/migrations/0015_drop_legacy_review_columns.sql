-- Peer reviews now live in peer_reviews (0014), which also copied every existing ranking across.
-- These columns are no longer read or written.
--
-- Note: the old single-paragraph review_critique cannot be split per reviewed persona, so dropping it
-- discards that text for sessions made before 0014. Their ranks are kept; only the paragraph is lost.

alter table persona_verdicts
  drop column if exists review_critique,
  drop column if exists review_ranking;
