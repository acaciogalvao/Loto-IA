# 🎰 LotoSmart AI

## Sistema Inteligente de Fechamento e Análise para Loterias

O **LotoSmart AI** é uma aplicação web progressiva (PWA) desenvolvida com React e TypeScript, focada em fornecer ferramentas avançadas para entusiastas de loterias. Utiliza Inteligência Artificial (Google Gemini) e análises estatísticas rigorosas para gerar fechamentos otimizados e conferir resultados.

---

### ✨ Funcionalidades Principais

#### 1. Múltiplos Jogos Suportados
O sistema suporta diversas loterias da Caixa Econômica Federal, adaptando as regras, volantes e cores para cada uma:
- **Lotofácil** (Padrão Ouro)
- **Mega-Sena**
- **Quina**
- **Lotomania**
- **Timemania**
- **Dia de Sorte**
- **Dupla Sena**
- **+Milionária**
- **Super Sete**
- **Federal** (Geração de bilhetes)

#### 2. Inteligência Artificial (Gemini)
- **Palpites Inteligentes**: A IA analisa tendências (números quentes/frios) para sugerir a base dos jogos.
- **Fechamentos Otimizados**: Gera matrizes de jogos focadas em maximizar a cobertura estatística.

#### 3. Ferramentas Matemáticas
- **Fechamento Balanceado**: Algoritmo que distribui os números selecionados de forma equilibrada entre os jogos gerados.
- **Análise Estatística em Tempo Real**: Ao expandir um jogo gerado, visualize métricas como:
  - Pares/Ímpares
  - Números Primos
  - Soma das Dezenas
  - Sequência de Fibonacci
  - Números na Moldura vs Centro
  - Repetidos do concurso anterior

#### 4. Raio-X Histórico
Uma ferramenta poderosa que permite buscar em todo o histórico da loteria por jogos que teriam sido premiados no passado.
- Filtre por ano.
- Filtre por faixa de premiação (ex: buscar apenas 15 pontos).
- Visualize detalhes como cidade dos ganhadores e valores pagos.

#### 5. Conferência Automática
- Salve seus jogos gerados no navegador.
- O sistema baixa automaticamente o último resultado.
- Ao abrir o app, ele confere seus jogos salvos contra o último concurso e notifica vitórias.

#### 6. Interface Moderna (Mobile-First)
- Design responsivo focado em uso mobile.
- Feedback tátil (vibração) em interações.
- Modo escuro (Dark Mode) nativo.
- Instalação como App (PWA).

---

### 🛠️ Tecnologias Utilizadas

- **Frontend**: React 19
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Animações**: Framer Motion
- **IA**: Google GenAI SDK (Gemini)
- **Dados**: API de Loterias (Guidi)
- **Persistência**: LocalStorage (Jogos salvos localmente no dispositivo do usuário)

---

### 🚀 Como Usar

1. **Selecione o Jogo**: Abra o menu lateral para trocar entre Lotofácil, Mega-Sena, etc.
2. **Escolha os Números**:
   - Toque nos números para selecionar manualmente.
   - Ou clique em **🔮 Palpite IA** para uma sugestão automática.
3. **Configure o Fechamento**:
   - Defina quantos números por jogo (ex: 15, 16, 17...).
   - Defina a quantidade de jogos a gerar (ex: 10, 50, 100...).
4. **Gere os Jogos**: Clique em "Gerar Jogos".
5. **Analise e Salve**:
   - Toque em "Stats" para ver a matemática do jogo.
   - Clique em "Salvar" para guardar no seu histórico.
   - Use o botão "Salvar Todos" para guardar o lote inteiro.
6. **Confira**: Acesse a pasta 📁 no topo para ver seus jogos salvos e se foram premiados no último concurso.

---

### ⚠️ Aviso Legal

Este é um **simulador estatístico**. Loterias são jogos de azar. O uso de IA e matemática aumenta a compreensão das probabilidades, mas **não garante vitórias**. Jogue com responsabilidade.