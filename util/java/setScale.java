import java.math.BigDecimal;
import java.math.RoundingMode;

public class Main {
    public static void main(String[] args) {
        System.out.println(new BigDecimal(args[0]).setScale(
                Integer.parseInt(args[1]),
                RoundingMode.valueOf(Integer.parseInt(args[2]))
        ));
    }
}
