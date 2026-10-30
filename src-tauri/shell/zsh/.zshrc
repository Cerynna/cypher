typeset -U path PATH

CYPHER_STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/cypher"
mkdir -p "$CYPHER_STATE_DIR"

HISTFILE="$CYPHER_STATE_DIR/zsh_history"
HISTSIZE=50000
SAVEHIST=50000
setopt share_history hist_ignore_dups hist_ignore_space
unsetopt beep

autoload -Uz compinit
compinit -d "$CYPHER_STATE_DIR/zcompdump"
zstyle ':completion:*' menu select

bindkey -e
bindkey '^[[H' beginning-of-line
bindkey '^[[F' end-of-line
bindkey '^[[3~' delete-char
bindkey '^[[1;5C' forward-word
bindkey '^[[1;5D' backward-word

alias ls='ls --color=auto'

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

PROMPT='%F{red}▌%f%F{cyan}%Bcypher%b%f %F{magenta}//%f %F{yellow}%~%f
%(?.%F{cyan}.%F{red})❯%f '

autoload -Uz add-zsh-hook

_cypher_osc() {
  printf '\e]%s\a' "$1"
}

_cypher_report_cwd() {
  local encoded=${PWD//\%/%25}
  encoded=${encoded// /%20}
  _cypher_osc "7;file://${HOST}${encoded}"
}

_cypher_precmd() {
  local exit_code=$?
  if [[ -n $_cypher_command_running ]]; then
    _cypher_osc "133;D;$exit_code"
    unset _cypher_command_running
  fi
  _cypher_report_cwd
  _cypher_osc "133;A"
}

_cypher_preexec() {
  _cypher_command_running=1
  _cypher_osc "133;C;cmd64=$(print -rn -- "$1" | base64 | tr -d '\n')"
}

add-zsh-hook precmd _cypher_precmd
add-zsh-hook preexec _cypher_preexec
PROMPT+=$'%{\e]133;B\a%}'

[[ -f "$HOME/.config/cypher/zshrc" ]] && source "$HOME/.config/cypher/zshrc"
