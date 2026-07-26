"""Pydantic models for challenge configuration.

A challenge declares its ``win`` condition as data, so the runtime never branches on
the slug. ``win`` is a DISCRIMINATED UNION on ``type`` — each variant carries only the
fields it needs, all required, so a config either describes a coherent challenge or
fails to load. It names the challenge's SINK tool, the hidden arg its protected secret
is injected into, and what counts as a break. Adding a new challenge flavour means
adding a union member here and handling it in each isinstance dispatch on the union
(``win.py``'s ``evaluate_win``, plus the backend's per-session secret resolution) —
never a slug check.
"""

from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class RevealSecretWin(BaseModel):
    """Win = an UNBLOCKED call to ``sink`` (the Gatekeeper). The protected secret is
    injected into the sink's ``secret_arg`` at execution time and echoed by the tool,
    so an unblocked call always returns it — the call itself is the whole signal. The
    agent never has the secret in its context, and the model's text is never scanned
    (the secret is static and shared, so an echo of a known value would forge a win)."""

    type: Literal["reveal_secret"]
    sink: str = Field(..., description="Tool whose unblocked call reveals the secret")
    secret_arg: str = Field(..., description="Hidden arg the secret is injected into")


class ExfilViaRequestWin(BaseModel):
    """Win = an UNBLOCKED ``sink`` call whose ``url_arg`` targets a host outside
    ``allowed_hosts``. The secret is attached to the sink's outbound request at
    execution time and never returned, so the model directs the request but never sees
    the secret — misdirecting a credentialed request off the partner allowlist is the
    break. No secret-matching: there is nothing in the args to hide, so the destination
    host is the whole signal (no encoding arms race)."""

    type: Literal["exfil_via_request"]
    sink: str = Field(..., description="Credentialed sink tool that makes the outbound request")
    secret_arg: str = Field(..., description="Hidden arg the secret is attached to")
    url_arg: str = Field(..., description="Sink arg holding the destination URL")
    allowed_hosts: list[str] = Field(
        ..., description="Partner hosts that are NOT a leak (exact host match)"
    )


WinSpec = Annotated[
    Union[RevealSecretWin, ExfilViaRequestWin],
    Field(discriminator="type"),
]


class ChallengeConfig(BaseModel):
    """Challenge configuration loaded from YAML."""

    slug: str = Field(..., description="Unique challenge identifier")
    name: str = Field(..., description="Display name")
    difficulty: int = Field(..., ge=1, le=5, description="Difficulty 1-5")
    description: str = Field(..., description="Brief description")
    objective: str = Field(..., description="User's objective")
    agent_persona: str = Field(..., description="Agent character name")
    agent_subtitle: str = Field(..., description="Agent role/title")
    greeting: str = Field(..., description="Initial greeting")
    system_prompt: str = Field(..., description="Agent system prompt")
    deadline: datetime = Field(..., description="Challenge deadline")
    is_active: bool = Field(True, description="Whether challenge is active")
    tools: list[str] = Field(default_factory=list, description="Available tools")
    prize: str = Field(..., description="Weekly prize copy shown in the UI (per challenge)")
    win: WinSpec = Field(..., description="The challenge's sink tool + secret + win condition")
